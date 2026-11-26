import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';

test('openbare NDW-kopie valideert gzip, XML, tijd, hash en veilige terugval zonder netwerk',()=>{
  execFileSync('python3',[new URL('./ndw_fetch_cases.py',import.meta.url).pathname,'-q'],{stdio:'pipe'});
});
test('DVM 161: openbare kopie van de NDW-planningsfeed valideert en valt veilig terug',()=>{
  execFileSync('python3',[new URL('./ndw_werk_fetch_cases.py',import.meta.url).pathname,'-q'],{stdio:'pipe'});
  const workflow=readFileSync(new URL('../.gitlab-ci.yml',import.meta.url),'utf8');
  assert.match(workflow,/fetch-ndw-werk\.py --output site\/ndw\/werk/);
});
test('3.00: NDW wordt uitsluitend in het GitLab Pages-artifact bijgewerkt, geen gebruikersupload of Git-write',()=>{
  const workflow=readFileSync(new URL('../.gitlab-ci.yml',import.meta.url),'utf8');
  assert.match(workflow,/17 \*\/4 \* \* \*/);
  assert.match(workflow,/fetch-ndw\.py --output site\/ndw/);
  assert.doesNotMatch(workflow,/git push|git commit/);
  assert.match(workflow,/publish: site/);assert.match(workflow,/--previous-base "\$CI_PAGES_URL"/);
  assert.equal(existsSync(new URL('../.github/workflows/pages.yml',import.meta.url)),false);
  assert.match(readFileSync(new URL('../.gitignore',import.meta.url),'utf8'),/site\/ndw\//);
  const frame=readFileSync(new URL('../site/engines/dvm.html',import.meta.url),'utf8');
  const shell=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
  assert.match(frame,/connect-src 'self';/);assert.match(shell,/connect-src 'none';/);
});
