'use strict';
let authorLibrary=[],solutionAuthor='all';
const authorBodyCache=new Map();
async function loadAuthorLibrary(){
  const response=await fetch('authors/index.json');
  if(!response.ok)throw Error('本地作者题解库缺失，请重新安装完整程序。');
  authorLibrary=await response.json();
}
function authorArticles(problem){return authorLibrary.filter(article=>article.problemId===problem.id);}
function availableSolutions(){return [...authorArticles(current),...current.solutions];}
function authorCard(article){
  return `<a class="solution-card imported-solution" href="#/problems/${current.id}/solutions/${article.id}"><span class="solution-author-avatar ${article.authorSlug}">${article.authorSlug==='jyd'?'K':'灵'}</span><div class="solution-entry"><div class="solution-author">${esc(article.author)} <span>· 已导入本机</span></div><h2>${esc(article.title)} <span class="solution-label">原作</span></h2><p>${esc(article.summary)}</p><div class="solution-entry-tags"><span class="topic-chip">完整正文</span><span class="topic-chip">Python3</span><span class="topic-chip">离线可读</span></div><div class="solution-entry-foot">${icon('file')}讲解与配图 ${icon('code')}原作者代码</div></div></a>`;
}
function authorDetail(article){
  return `<article class="compact-lesson imported-lesson" data-article="${article.id}"><h1 class="lesson-title">${esc(article.title)}</h1><div class="lesson-author"><span class="solution-author-avatar ${article.authorSlug}">${article.authorSlug==='jyd'?'K':'灵'}</span><div><span>${esc(article.author)}</span><p>${current.id}. ${esc(current.title)} · 已导入本机</p></div></div><div class="lesson-topic-tags"><span class="solution-label">作者原作</span><span class="topic-chip">离线正文</span>${difficultyBadge(current)}</div><p class="author-code-note">原文保留力扣函数式代码。<a href="#/problems/${current.id}/solutions/recommended">查看本题 ACM 完整程序 ${icon('right')}</a></p><div class="author-body" id="author-body">${authorBodyCache.get(article.id)||'<div class="skeleton" aria-label="正在读取本地题解"></div>'}</div><footer class="author-attribution"><strong>作者：${esc(article.author)}</strong><p>来源：${esc(article.sourceType==='licensed-repository'?'作者公开仓库':'力扣原作者题解')} · ${esc(article.license)}</p><p>正文与代码保留原作；本站仅调整排版、代码语言展示和配图浏览方式。</p><details><summary>出处与授权说明</summary><a href="${esc(article.sourceUrl)}" target="_blank" rel="noopener">原始出处</a>${article.license==='MIT'?'<p><a href="third-party/EndlessCheng-MIT.txt" target="_blank" rel="noopener">MIT 许可全文</a></p>':article.authorSlug==='jyd'?'<p><a href="third-party/Krahets-CC-BY-NC-SA-4.0.txt" target="_blank" rel="noopener">CC BY-NC-SA 4.0 许可全文</a></p>':'<p>按用户已确认取得的作者授权，供本机个人学习阅读。</p>'}</details></footer></article>`;
}
function updateAuthorDirectory(){
  const directory=$('.lesson-directory');if(!directory)return;
  directory.innerHTML=$$('#author-body h1,#author-body h2,#author-body h3,#author-body h4').map((heading,i)=>{
    heading.id=`author-heading-${i}`;
    return `<button data-section="author-heading-${i}">${esc(heading.textContent)}</button>`;
  }).join('')||'<p>本篇没有章节目录</p>';
}
function prepareAuthorBody(){
  const body=$('#author-body');if(!body)return;
  body.querySelectorAll('.author-math').forEach(element=>katex.render(element.dataset.tex,element,{displayMode:element.dataset.display==='true',throwOnError:false,trust:false,strict:'ignore'}));
  // LeetCode's adjacent language implementations become tabs, with Python selected.
  let group=[];
  const flush=()=>{
    if(group.length<2){group=[];return;}
    const wrapper=document.createElement('div');wrapper.className='author-code-tabs';
    const tabs=document.createElement('div');tabs.className='author-language-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','原作者代码语言');
    group[0].before(wrapper);wrapper.append(tabs);
    let selected=group.findIndex(box=>box.querySelector('pre').dataset.language==='python');if(selected<0)selected=0;
    group.forEach((box,i)=>{const button=document.createElement('button');button.type='button';button.textContent=box.querySelector('.author-code-bar span').textContent;button.dataset.authorLanguage=String(i);button.setAttribute('role','tab');button.setAttribute('aria-selected',String(i===selected));button.classList.toggle('selected',i===selected);tabs.append(button);wrapper.append(box);box.hidden=i!==selected;});
    group=[];
  };
  [...body.children].forEach(element=>{if(element.classList.contains('author-code-box'))group.push(element);else flush();});flush();
  updateAuthorDirectory();colorizeCode();
}
async function mountAuthorArticle(article,epoch,reading){
  try{
    if(!authorBodyCache.has(article.id)){
      if(!/^authors\/[a-z]+\/\d+\.html$/.test(article.htmlFile))throw Error('题解文件路径无效');
      const response=await fetch(article.htmlFile);if(!response.ok)throw Error('本地题解文件读取失败');
      authorBodyCache.set(article.id,await response.text());
    }
    if(epoch!==routeEpoch||$('.imported-lesson')?.dataset.article!==article.id)return;
    restoringReading=true;$('#author-body').innerHTML=authorBodyCache.get(article.id);prepareAuthorBody();
    requestAnimationFrame(()=>{if(epoch===routeEpoch){$('#solution-content').scrollTop=reading;restoringReading=false;}});
  }catch(error){if(epoch===routeEpoch)$('#author-body').innerHTML=`<p class="rejected">${esc(error.message)}，请刷新重试。</p>`;}
}
document.addEventListener('click',event=>{
  const author=event.target.closest('[data-solution-author]');
  if(author){solutionAuthor=author.dataset.solutionAuthor;renderContent();}
  const language=event.target.closest('[data-author-language]');
  if(language){const wrapper=language.closest('.author-code-tabs');wrapper.querySelectorAll('[data-author-language]').forEach(button=>{const selected=button===language;button.classList.toggle('selected',selected);button.setAttribute('aria-selected',String(selected));});[...wrapper.querySelectorAll('.author-code-box')].forEach((box,i)=>box.hidden=i!==Number(language.dataset.authorLanguage));}
  const copyButton=event.target.closest('.author-copy');if(copyButton){const pre=copyButton.closest('.author-code-box').querySelector('pre');copy(annotatedCodeSources.get(pre)??pre.textContent);}
  const frame=event.target.closest('[data-gallery-step]');
  if(frame){const gallery=frame.closest('.author-gallery'),images=[...gallery.querySelectorAll('img')];let index=images.findIndex(img=>!img.hidden);index=(index+Number(frame.dataset.galleryStep)+images.length)%images.length;images.forEach((img,i)=>img.hidden=i!==index);gallery.querySelector('.author-frame-count').textContent=`${index+1} / ${images.length}`;}
});
