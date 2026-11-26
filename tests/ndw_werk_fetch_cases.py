"""DVM 161: openbare kopie van de NDW-planningsfeed. Synthetisch, zonder netwerk."""
import gzip
import hashlib
import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path

spec = importlib.util.spec_from_file_location('ndw_werk_fetch', Path(__file__).resolve().parents[1] / 'scripts/fetch-ndw-werk.py')
werk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(werk)

XML = ('<mc:messageContainer xmlns:mc="urn:mc" xmlns:sit="urn:sit" xmlns:com="urn:com" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
       '<mc:payload xsi:type="sit:SituationPublication"><com:publicationTime>2026-01-02T11:00:00.123456789Z</com:publicationTime>'
       '<sit:situation id="A"><sit:situationRecord/></sit:situation><sit:situation id="B"/></mc:payload></mc:messageContainer>')


class WerkCacheTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 1, 2, 12, tzinfo=timezone.utc)
        self.temp = tempfile.TemporaryDirectory()
        self.output = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        self.data = gzip.compress(XML.encode())

    def test_valid(self):
        m = werk.refresh(self.output, now=self.now, fetch=lambda u: self.data)
        self.assertEqual(m['status'], 'ready')
        self.assertEqual(m['situations'], 2)
        self.assertEqual(m['publication'], '2026-01-02T11:00:00.123456Z')
        self.assertEqual(m['file'], 'werk-' + hashlib.sha256(self.data).hexdigest() + '.xml.gz')
        self.assertEqual((self.output / m['file']).read_bytes(), self.data)
        self.assertEqual(json.loads((self.output / 'latest.json').read_text()), m)

    def test_invalid_and_stale(self):
        invalid = [b'<html>error</html>', b'\x1f\x8bbroken', gzip.compress(b'<root/>'),
                   gzip.compress(XML.replace('SituationPublication', 'MeasuredDataPublication').encode()),
                   gzip.compress(XML.replace('2026-01-02T11:00', '2026-01-01T11:00').encode()),
                   gzip.compress(XML.replace('2026-01-02T11:00', '2026-01-03T11:00').encode()),
                   gzip.compress(b'<!DOCTYPE root [<!ENTITY x "data">]>' + XML.encode())]
        for body in invalid:
            with self.subTest(body=body[:12]):
                m = werk.refresh(self.output, now=self.now, fetch=lambda u: body)
                self.assertEqual(m['status'], 'unavailable')
                self.assertEqual(list(self.output.glob('*.gz')), [])

    def test_retains_previous_up_to_26_hours(self):
        previous = werk.refresh(self.output, now=self.now, fetch=lambda u: self.data)
        requests = []

        def fetch(url):
            requests.append(url)
            if url == werk.SOURCE:
                raise OSError('Offline')
            return json.dumps(previous).encode() if url.endswith('latest.json') else self.data
        m = werk.refresh(self.output, 'https://example.gitlab.io/Project/', self.now + timedelta(hours=20), fetch)
        self.assertTrue(m['retained'])
        self.assertEqual(requests[1], 'https://example.gitlab.io/Project/ndw/werk/latest.json')
        m = werk.refresh(self.output, 'https://example.gitlab.io/Project/', self.now + timedelta(hours=27), fetch)
        self.assertEqual(m['status'], 'unavailable')

    def test_rejects_previous_hash_or_external_filename(self):
        previous = werk.refresh(self.output, now=self.now, fetch=lambda u: self.data)
        for bad in [{'file': 'https://external.invalid/feed'}, {'sha256': '0' * 64}, {'source': 'https://external.invalid'}]:
            def fetch(url, bad=bad):
                if url == werk.SOURCE:
                    raise OSError('Offline')
                return json.dumps({**previous, **bad}).encode() if url.endswith('latest.json') else self.data
            m = werk.refresh(self.output, 'https://example.gitlab.io/Project', self.now, fetch)
            self.assertEqual(m['status'], 'unavailable')

    def test_xml_limit(self):
        original = werk.MAX_XML_BYTES
        werk.MAX_XML_BYTES = 10
        try:
            with self.assertRaises(ValueError):
                werk.validate(self.data, self.now)
        finally:
            werk.MAX_XML_BYTES = original


if __name__ == '__main__':
    unittest.main()
