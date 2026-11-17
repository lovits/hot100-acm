import json,re,time,urllib.request,concurrent.futures
from pathlib import Path
from datetime import datetime,timezone
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[2]
ps=json.loads((ROOT/'dist/training/data/problems.json').read_text())
query='''query questionData($titleSlug:String!){question(titleSlug:$titleSlug){questionFrontendId titleSlug title translatedTitle difficulty translatedContent content metaData exampleTestcases codeSnippets{langSlug code} topicTags{name translatedName}}}'''
def fetch(p):
 for attempt in range(4):
  try:
   slug=p['url'].rstrip('/').split('/')[-1]
   req=urllib.request.Request('https://leetcode.cn/graphql/',json.dumps({'query':query,'variables':{'titleSlug':slug}}).encode(),headers={'Content-Type':'application/json','Referer':p['url'],'User-Agent':'Mozilla/5.0'})
   q=json.load(urllib.request.urlopen(req,timeout=40))['data']['question'];assert int(q['questionFrontendId'])==p['id'];return p,q
  except Exception:
   if attempt==3:raise
   time.sleep(attempt+1)
rows=[];report=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for p,q in pool.map(fetch,ps):
  tags=[t['translatedName'] or t['name'] for t in q['topicTags']]
  soup=BeautifulSoup(q['translatedContent'] or q['content'],'html.parser')
  for n in soup.find_all(['sup','sub']):n.replace_with(('^' if n.name=='sup' else '_')+n.get_text())
  text=soup.get_text('\n',strip=True)
  before={'title':p['title'],'tags':p['topicTags'],'difficulty':p['difficulty']}
  after={'title':q['translatedTitle'] or q['title'],'tags':tags,'difficulty':{'Easy':'简单','Medium':'中等','Hard':'困难'}[q['difficulty']]}
  report.append({'id':p['id'],'url':p['url'],'metadataMatches':before==after,'before':before,'official':after,'localStatementIsAdaptation':True,'resolution':'插件使用本次获取的官方完整题面与官方三语言签名；ACM 输入输出另列为训练格式。'})
  p.update(title=after['title'],difficulty=after['difficulty'],topicTags=tags,officialText=text,officialHtml=q['translatedContent'] or q['content'],officialTemplates={c['langSlug']:c['code'] for c in q['codeSnippets'] if c['langSlug'] in ['c','cpp','python3']},officialMeta=json.loads(q['metaData']))
  rows.append(p)
  print('Official checked',len(rows),flush=True)
out=ROOT/'vscode-extension/data';out.mkdir(exist_ok=True)
(out/'problems.json').write_text(json.dumps(rows,ensure_ascii=False,indent=1))
(ROOT/'reference/vscode-official-audit.json').write_text(json.dumps({'checkedAt':datetime.now(timezone.utc).isoformat(),'baseRelease':'v1.0.11','questions':report,'count':len(rows),'metadataDifferences':sum(not r['metadataMatches'] for r in report),'note':'原应用题面为摘要/ACM改写，不是官网逐字复制。插件完整题面直接取官方；不声称覆盖官网私有隐藏用例。'},ensure_ascii=False,indent=2))
