"""Run all official examples after their documented ACM input conversion."""
import contextlib
import io
import json
from pathlib import Path
import sys
ROOT=Path(__file__).parent
native='--native' in sys.argv
solutions=json.loads((ROOT/'dist/training/data/solutions.json').read_text(encoding='utf-8')) if native else None
problems={p['id']:p for p in json.loads((ROOT/'dist/problems.json').read_text(encoding='utf-8'))}
cases=json.loads((ROOT/('reference/leetcode-official-native-acm-cases.json' if native else 'reference/leetcode-official-acm-cases.json')).read_text(encoding='utf-8'))
results=[]
for ident,rows in cases.items():
    code=compile(solutions[ident]['python3']['acm'] if native else problems[int(ident)]['solution'],f'problem_{ident}.py','exec')
    for index,case in enumerate(rows):
        old=sys.stdin
        output=io.StringIO()
        row={'id':int(ident),'index':index,**case}
        try:
            sys.stdin=io.StringIO(case['input'])
            with contextlib.redirect_stdout(output):exec(code,{'__name__':'__main__'})
            row['got']=output.getvalue()
        except Exception as error:row['error']=str(error)
        finally:sys.stdin=old
        results.append(row)
(ROOT/('reference/official-native-acm-results.json' if native else 'reference/official-acm-results.json')).write_text(json.dumps(results,ensure_ascii=False,indent=1),encoding='utf-8')
