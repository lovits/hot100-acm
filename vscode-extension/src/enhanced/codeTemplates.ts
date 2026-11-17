import {normalizeLangSlug} from '../utils/languageUtils';

// Preserve Pro's complete language list; core mode uses official snippets.
export function acmTemplate(language: string): string {
    const templates: Record<string,string> = {
        python3: 'import sys\n\ndef solve():\n    # 读取输入，计算并输出结果\n    pass\n\nif __name__ == "__main__":\n    solve()\n',
        cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // 读取输入，计算并输出结果\n    return 0;\n}\n',
        c: '#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n    // 读取输入，计算并输出结果\n    return 0;\n}\n',
        java: 'import java.util.*;\n\nclass Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        // 读取输入，计算并输出结果\n    }\n}\n',
        javascript: "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8');\n// 读取输入，计算并输出结果\n",
        typescript: "import * as fs from 'fs';\nconst input: string = fs.readFileSync(0, 'utf8');\n// 读取输入，计算并输出结果\n",
        go: 'package main\n\nimport (\n    "bufio"\n    "os"\n)\n\nfunc main() {\n    in := bufio.NewReader(os.Stdin)\n    _ = in\n    // 读取输入，计算并输出结果\n}\n',
        rust: 'use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    // 读取输入，计算并输出结果\n}\n',
        csharp: 'using System;\n\nclass Program {\n    static void Main() {\n        // 读取输入，计算并输出结果\n    }\n}\n',
        kotlin: 'fun main() {\n    // 读取输入，计算并输出结果\n}\n',
        swift: 'import Foundation\n\n// 读取输入，计算并输出结果\n',
        ruby: '# 读取输入，计算并输出结果\ninput = STDIN.read\n',
        scala: 'object Main {\n    def main(args: Array[String]): Unit = {\n        // 读取输入，计算并输出结果\n    }\n}\n',
        php: '<?php\n$input = file_get_contents("php://stdin");\n// 读取输入，计算并输出结果\n'
    };
    const template=templates[normalizeLangSlug(language)];
    if(!template)throw Error(`未找到 ${language} 的 ACM 模板。`);
    return template;
}


// Use standard headers so editor diagnostics work with macOS Clang as well as GCC.
const cppHeaders = ['algorithm','array','bitset','cassert','cctype','climits','cmath','cstddef','cstdint','cstdio','cstdlib','cstring','deque','functional','iomanip','iostream','iterator','limits','list','map','memory','numeric','queue','set','sstream','stack','string','tuple','unordered_map','unordered_set','utility','vector']
    .map(name=>`#include <${name}>`).join('\n');
export function cppEditorSource(source: string, core = false): string {
    let result=source.replace(/^\s*#\s*include\s*[<"]bits\/stdc\+\+\.h[>"][^\r\n]*/gm,cppHeaders);
    if(!/^\s*#\s*include\s*<vector>/m.test(result))result=cppHeaders+'\n'+result;
    if(!/^\s*using\s+namespace\s+std\s*;/m.test(result))result=result.replace('#include <vector>','#include <vector>\nusing namespace std;');
    // LeetCode supplies these types; only the editor needs local declarations.
    if(core&&!result.includes('// Hot100 editor-only types')) {
        const types=[
            /\bListNode\s*\*/.test(source)?'struct ListNode { int val; ListNode *next; ListNode(int x=0):val(x),next(nullptr){} };':'',
            /\bTreeNode\s*\*/.test(source)?'struct TreeNode { int val; TreeNode *left,*right; TreeNode(int x=0):val(x),left(nullptr),right(nullptr){} };':'',
            /\bNode\s*\*/.test(source)?'class Node { public: int val; Node *next,*random; Node(int x=0):val(x),next(nullptr),random(nullptr){} };':''
        ].filter(Boolean).join('\n');
        if(types)result='#ifdef __INTELLISENSE__\n// Hot100 editor-only types\n'+types+'\n#endif\n'+result;
    }
    return result;
}
