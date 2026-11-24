MG.ready.then(async()=>{
  try {
    for(const name of ['questions','app','auth','experience','exam']) {
      await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=name+'.js?v='+(name==='questions'?'20261124-topic-proof':name==='app'?'20261122-study':'20261018-topic-nav');s.onload=resolve;s.onerror=reject;document.body.append(s)});
    }
  } catch {document.getElementById('app').textContent='无法加载练习，请刷新重试。'}
});
