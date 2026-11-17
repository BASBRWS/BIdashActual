"""Publiceer de openbare NDW-planningsfeed wegwerkzaamheden in het Pages-artifact.

DVM 161. Zelfde werkwijze als fetch-ndw.py: alleen de openbare NDW-bron, nooit
gebruikersdata. opendata.ndw.nu staat geen CORS toe, daarom haalt de workflow het
bestand op en zet het met een manifest (sha256, grootte, publicatietijd) naast de site.
Een mislukte download blokkeert de site niet; een vorige geldige kopie blijft dan staan.
"""
import argparse
import gzip
import hashlib
import io
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

SOURCE = 'https://opendata.ndw.nu/planningsfeed_wegwerkzaamheden_en_evenementen.xml.gz'
MAX_BYTES = 40 * 1024 * 1024
MAX_XML_BYTES = 768 * 1024 * 1024
# De planningsfeed verandert langzaam. Een verse download moet hooguit zes uur oud zijn;
# een vorige kopie mag tot 26 uur oud zijn (dezelfde grens als de knop in de browser).
MAX_AGE = timedelta(hours=6)
MAX_AGE_RETAINED = timedelta(hours=26)
REFRESH_MINUTES = 240


def iso(value):
    return value.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def date(value):
    value = value.strip().replace('Z', '+00:00')
    # NDW levert soms nanoseconden; Python accepteert er hooguit zes.
    value = re.sub(r'(\.\d{6})\d+', r'\1', value)
    return datetime.fromisoformat(value).astimezone(timezone.utc)


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'BiDash NDW public feed', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(req, timeout=90) as response:
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError('NDW-planningsfeed overschrijdt de downloadlimiet.')
        return data


class _Begrensd(io.RawIOBase):
    """Leest de uitgepakte XML als stroom en stopt boven MAX_XML_BYTES."""

    def __init__(self, stream):
        self.stream, self.total = stream, 0

    def readable(self):
        return True

    def readinto(self, buffer):
        data = self.stream.read(len(buffer))
        self.total += len(data)
        if self.total > MAX_XML_BYTES:
            raise ValueError('NDW-planningsfeed XML overschrijdt de limiet.')
        buffer[:len(data)] = data
        return len(data)


def validate(data, now, max_age=MAX_AGE):
    if not data.startswith(b'\x1f\x8b'):
        raise ValueError('NDW-planningsfeed is geen gzipbestand.')
    with gzip.GzipFile(fileobj=io.BytesIO(data)) as stream:
        kop = stream.peek(65536)[:65536].upper() if hasattr(stream, 'peek') else b''
        if b'<!DOCTYPE' in kop or b'<!ENTITY' in kop:
            raise ValueError('NDW-planningsfeed bevat een documenttype.')
        publication = None
        situations = 0
        payload = False
        for event, elem in ET.iterparse(io.BufferedReader(_Begrensd(stream)), events=['start', 'end']):
            tag = elem.tag.split('}')[-1]
            if event == 'start':
                if tag == 'payload' and 'SituationPublication' in ''.join(elem.attrib.values()):
                    payload = True
                continue
            if tag == 'publicationTime' and elem.text and publication is None:
                publication = date(elem.text)
            elif tag == 'situation':
                situations += 1
                elem.clear()
    if not payload or not situations or publication is None:
        raise ValueError('NDW-planningsfeed mist SituationPublication, situaties of publicatietijd.')
    if now - publication > max_age or publication - now > timedelta(minutes=5):
        raise ValueError('NDW-planningsfeed is te oud of ligt in de toekomst.')
    return iso(publication), situations


def write(output, data, publication, situations, downloaded, attempt, retained=False):
    sha = hashlib.sha256(data).hexdigest()
    filename = 'werk-' + sha + '.xml.gz'
    output.mkdir(parents=True, exist_ok=True)
    (output / filename).write_bytes(data)
    manifest = {'schema': 1, 'status': 'ready', 'source': SOURCE, 'file': filename,
                'sha256': sha, 'bytes': len(data), 'publication': publication,
                'situations': situations, 'downloadedAt': downloaded, 'attemptedAt': attempt,
                'retained': retained, 'refreshMinutes': REFRESH_MINUTES}
    (output / 'latest.json').write_text(json.dumps(manifest, ensure_ascii=False) + '\n')
    return manifest


def refresh(output, previous_base='', now=None, fetch=fetch_bytes):
    now = now or datetime.now(timezone.utc)
    attempt = iso(now)
    try:
        data = fetch(SOURCE)
        publication, situations = validate(data, now)
        return write(output, data, publication, situations, attempt, attempt)
    except Exception:
        if previous_base:
            try:
                base = previous_base.rstrip('/') + '/ndw/werk/'
                manifest = json.loads(fetch(base + 'latest.json'))
                filename = manifest.get('file', '')
                if manifest.get('source') != SOURCE or manifest.get('schema') != 1 or not re.fullmatch(r'werk-[a-f0-9]{64}\.xml\.gz', filename):
                    raise ValueError('Ongeldig vorig manifest.')
                data = fetch(base + filename)
                sha = hashlib.sha256(data).hexdigest()
                if manifest.get('sha256') != sha or filename != 'werk-' + sha + '.xml.gz':
                    raise ValueError('Vorige kopie heeft een afwijkende vingerafdruk.')
                publication, situations = validate(data, now, MAX_AGE_RETAINED)
                if date(manifest['downloadedAt']) > now + timedelta(minutes=5):
                    raise ValueError('Ongeldige ophaaltijd.')
                return write(output, data, publication, situations, manifest['downloadedAt'], attempt, True)
            except Exception:
                pass
        output.mkdir(parents=True, exist_ok=True)
        manifest = {'schema': 1, 'status': 'unavailable', 'source': SOURCE,
                    'attemptedAt': attempt, 'refreshMinutes': REFRESH_MINUTES}
        (output / 'latest.json').write_text(json.dumps(manifest) + '\n')
        return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--previous-base', default='')
    args = parser.parse_args()
    result = refresh(args.output, args.previous_base)
    print('Openbare NDW-planningsfeed voorbereid.' if result['status'] == 'ready' else 'NDW-planningsfeed nu niet beschikbaar; website blijft beschikbaar.')
