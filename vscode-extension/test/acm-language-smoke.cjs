'use strict';
// Tests the ACM stdin/stdout adapters, not correctness of 100 problem solutions.
const assert=require('node:assert/strict');
const {evaluate}=require('../engine');
const {acmTemplate}=require('../out/enhanced/codeTemplates');
const codes={
 python3:'import sys\na=list(map(int,sys.stdin.read().split())); print(sum(a[1:1+a[0]]))',
 cpp:'#include <iostream>\nint main(){int n,x;long long s=0;std::cin>>n;while(n--){std::cin>>x;s+=x;}std::cout<<s;}',
 c:'#include <stdio.h>\nint main(void){int n,x;long long s=0;scanf("%d",&n);while(n--){scanf("%d",&x);s+=x;}printf("%lld",s);return 0;}',
 java:'import java.util.*; class Main {public static void main(String[] args){Scanner in=new Scanner(System.in);int n=in.nextInt();long s=0;while(n-->0)s+=in.nextInt();System.out.println(s);}}',
 go:'package main\nimport "fmt"\nfunc main(){var n,x int;var s int64;fmt.Scan(&n);for i:=0;i<n;i++{fmt.Scan(&x);s+=int64(x)};fmt.Println(s)}',
 javascript:'const a=require("fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);console.log(a.slice(1,1+a[0]).reduce((s,x)=>s+x,0));',
 typescript:'import * as fs from "fs";const a:number[]=fs.readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);console.log(a.slice(1,1+a[0]).reduce((s,x)=>s+x,0));',
 rust:'use std::io::{self,Read};fn main(){let mut s=String::new();io::stdin().read_to_string(&mut s).unwrap();let mut it=s.split_whitespace();let n:usize=it.next().unwrap().parse().unwrap();let sum:i64=it.take(n).map(|x|x.parse::<i64>().unwrap()).sum();println!("{}",sum);}',
 csharp:'using System;class Program {static void Main(){var a=Console.In.ReadToEnd().Split((char[])null,StringSplitOptions.RemoveEmptyEntries);int n=int.Parse(a[0]);long sum=0;for(int i=1;i<=n;i++)sum+=long.Parse(a[i]);Console.WriteLine(sum);}}',
 kotlin:'fun main(){val a=System.`in`.bufferedReader().readText().trim().split(Regex("\\\\s+"));val n=a[0].toInt();var s=0L;for(i in 1..n)s+=a[i].toLong();println(s)}',
 scala:'object Main {def main(args:Array[String]):Unit={val a=scala.io.Source.stdin.mkString.trim.split("\\\\s+");val n=a(0).toInt;println(a.slice(1,n+1).map(_.toLong).sum)}}',
 php:'<?php $a=preg_split("/\\s+/",trim(file_get_contents("php://stdin")));$n=intval($a[0]);$s=0;for($i=1;$i<=$n;$i++)$s+=intval($a[$i]);echo $s;',
 swift:'import Foundation\nlet a=String(data:FileHandle.standardInput.readDataToEndOfFile(),encoding:.utf8)!.split(whereSeparator:{$0.isWhitespace}).map{Int64($0)!}\nlet n=Int(a[0]);let s=a.dropFirst().prefix(n).reduce(Int64(0),+);print(s)',
 ruby:'a=STDIN.read.split.map(&:to_i); n=a.shift; puts a.take(n).sum'
};
const cases=[{input:'4\n2 -7 2 10\n',output:'7'},{input:'0\n',output:'0'},{input:'3\n-5\t-2 -1',output:'-8'},{input:'1\n9\n',output:'9'}];
(async()=>{let executed=0;for(const [language,code]of Object.entries(codes)){
 const result=await evaluate({acm:{}},language,'acm',code,cases);
 if(result.error){
  if(result.error.includes('未找到')||language==='swift'&&result.error.includes('SwiftBridging')){console.log(language+': environment unavailable; NOT runtime verified');continue;}
  throw Error(language+': '+result.error);
 }
 assert.ok(result.results.every(x=>x.ok),language+': '+JSON.stringify(result));executed++;
 const initial=await evaluate({acm:{}},language,'acm',acmTemplate(language),[{input:''}]);
 assert.ok(!initial.error&&initial.results.every(x=>!x.error),language+' starter: '+JSON.stringify(initial));
 console.log(language+': '+cases.length+' ACM cases and initial template passed');
}console.log('Runtime-verified languages:',executed,'/',Object.keys(codes).length);})().catch(e=>{console.error(e);process.exitCode=1;});
