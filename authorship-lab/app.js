import { Editor, Node } from 'https://cdn.jsdelivr.net/npm/@tiptap/core@3.31.3/+esm';
import StarterKit from 'https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@3.31.3/+esm';
import katex from 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.mjs';

const $ = (id) => document.getElementById(id);
const state = {
  start: Date.now(), lastInput: 0, typed: 0, pastes: 0, pastedChars: 0,
  edits: 0, deletes: 0, pauses: 0, focus: 0, submitted: false, checked: false,
  events: [], snapshots: [{at:Date.now(),html:'<p></p>',text:'',reason:'Initial state'}],
  playback:null, resetting:false
};
const formatTime = (ms) => {
  const d = Math.max(0,Math.floor(ms/1000));
  return String(Math.floor(d/60)).padStart(2,'0')+':'+String(d%60).padStart(2,'0');
};
const relativeTime = (ms) => formatTime(ms-state.start);
const esc = (t) => String(t).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mathOptions = {throwOnError:false,strict:'ignore',trust:false};
const latexRender = (latex, el, displayMode=false) => {
  try { katex.render(latex,el,{...mathOptions,displayMode}); }
  catch(err) { el.textContent=latex; }
};
const initFixedMath = (root=document) => {
  root.querySelectorAll('.inline-math, .display-math, [data-math-inline]').forEach(el=>{
    const latex=el.getAttribute('data-latex');
    if(latex) latexRender(latex,el,el.classList.contains('display-math'));
  });
};

const MathInline = Node.create({
  name:'mathInline',group:'inline',inline:true,atom:true,selectable:true,
  addAttributes(){return {latex:{default:'x',parseHTML:element=>element.getAttribute('data-latex'),renderHTML:attributes=>({'data-latex':attributes.latex})}};},
  parseHTML(){return [{tag:'span[data-math-inline]'}];},
  renderHTML({node}){return ['span',{'data-math-inline':'true','data-latex':node.attrs.latex,class:'math-node'}];},
  addNodeView(){return ({node})=>{
    const dom=document.createElement('span');
    dom.className='math-node';dom.setAttribute('data-math-inline','true');
    dom.setAttribute('data-latex',node.attrs.latex);
    dom.setAttribute('contenteditable','false');
    latexRender(node.attrs.latex,dom);
    return {dom};
  };}
});

function logEvent(type,details,characters=0) {
  if(state.resetting) return;
  const now=Date.now();
  const previous=state.events[state.events.length-1];
  if(type==='typing'&&previous&&previous.type==='typing'&&now-previous.at<1300){
    previous.at=now;previous.characters=(previous.characters||0)+characters;
    previous.details=previous.characters+' typed character'+(previous.characters===1?'':'s');
  } else {
    state.events.push({at:now,type,details,characters:type==='typing'?characters:undefined});
  }
  if(state.events.length>3000) state.events.shift();
  renderStats();
  renderActivity();
}
function activityStyle(type){
  if(type==='paste') return {icon:'⧉',cls:'paste',title:'Paste detected'};
  if(type==='typing') return {icon:'⌨',cls:'',title:'Typing'};
  if(type==='focus'||type==='blur') return {icon:'◎',cls:'focus',title:type==='focus'?'Editor focused':'Editor unfocused'};
  if(type==='pause') return {icon:'◷',cls:'',title:'Writing pause'};
  if(type==='delete') return {icon:'⌫',cls:'',title:'Deletion'};
  if(type==='math') return {icon:'∑',cls:'',title:'Equation inserted'};
  if(type==='format') return {icon:'✎',cls:'',title:'Formatting action'};
  if(type==='submit') return {icon:'✓',cls:'focus',title:'Practice submitted'};
  if(type==='check') return {icon:'◆',cls:'focus',title:'Answer checkpoint'};
  return {icon:'↺',cls:'',title:'Document edit'};
}
function renderStats(){
  $('statTyped').textContent=state.typed.toLocaleString();
  $('statPastes').textContent=state.pastes;
  $('statRevisions').textContent=state.edits;
  $('statPauses').textContent=state.pauses;
  $('eventTotal').textContent=state.events.length+' events';
  $('reportEdits').textContent=state.edits;
  $('reportPasteChars').textContent=state.pastedChars.toLocaleString();
  $('reportFocus').textContent=state.focus;
  $('timelineCount').textContent=state.events.length+' EVENTS';
}
function renderActivity(){
  const list=$('activityList');list.replaceChildren();
  if(!state.events.length){
    list.innerHTML='<div class="empty-state"><span>◎</span><p>Activity will appear here as you write.</p></div>';return;
  }
  state.events.slice(-8).reverse().forEach(event=>{
    const style=activityStyle(event.type);
    const item=document.createElement('div');item.className='activity-item';
    const ico=document.createElement('span');ico.className='event-icon '+style.cls;ico.textContent=style.icon;
    const detail=document.createElement('div');detail.className='event-text';
    const title=document.createElement('b');title.textContent=style.title;
    const sub=document.createElement('small');sub.textContent=event.details;
    const time=document.createElement('span');time.className='event-time';time.textContent=relativeTime(event.at);
    detail.append(title,sub);item.append(ico,detail,time);list.append(item);
  });
}
function renderTimeline(){
  const list=$('timelineList');list.replaceChildren();
  if(!state.events.length){
    list.innerHTML='<div class="empty-state"><span>⌁</span><p>Start typing in the student workspace to build the timeline.</p></div>';return;
  }
  state.events.slice(-80).reverse().forEach(event=>{
    const style=activityStyle(event.type);
    const row=document.createElement('div');row.className='timeline-item';
    const ico=document.createElement('span');ico.className='event-icon '+style.cls;ico.textContent=style.icon;
    const body=document.createElement('div');body.className='timeline-content';
    const title=document.createElement('strong');title.textContent=style.title;
    const desc=document.createElement('p');desc.textContent=event.details;
    const when=document.createElement('time');when.textContent='At '+relativeTime(event.at);
    body.append(title,desc,when);row.append(ico,body);list.append(row);
  });
}
function updateClock(){
  const duration=formatTime(Date.now()-state.start);
  $('elapsed').textContent=duration;$('reportTime').textContent=duration;
}
function renderReplay(index){
  const max=state.snapshots.length-1;
  const pos=Math.min(Math.max(0,index),max);
  const snap=state.snapshots[pos];
  $('replaySlider').max=String(max);$('replaySlider').value=String(pos);
  $('replayVersion').textContent=String(pos);
  $('replayTotal').textContent=String(max);
  $('replayStepLabel').textContent=pos+' / '+max;
  $('replayTimestamp').textContent=pos===0?'Initial state':'At '+relativeTime(snap.at)+' · '+snap.reason;
  $('replayBody').innerHTML=snap.html||'<p></p>';
  initFixedMath($('replayBody'));
}
function stopPlayback(){
  if(state.playback)clearInterval(state.playback);
  state.playback=null;$('playReplay').textContent='▶';
  $('playReplay').setAttribute('aria-label','Play replay');
}
function snapshotContent(editor){
  if(state.resetting)return;
  const prior=state.snapshots[state.snapshots.length-1];
  const html=editor.getHTML();
  if(prior&&prior.html===html)return;
  const lastEvent=state.events[state.events.length-1];
  const reason=lastEvent?activityStyle(lastEvent.type).title:'Document edited';
  const now=Date.now();
  state.snapshots.push({at:now,html,text:editor.getText(),reason});
  if(state.snapshots.length>1200)state.snapshots.splice(1,1);
  renderReplay(state.snapshots.length-1);
}
function updateInsight(){
  const title=$('insightSummary'),desc=$('insightDescription');
  if(!state.edits&&!state.pastes){
    title.textContent='No writing yet';
    desc.textContent='Return to the student workspace and write a solution to generate evidence.';
  }else if(state.pastes){
    title.textContent=state.pastes+' paste event'+(state.pastes===1?'':'s')+' recorded';
    desc.textContent=state.pastedChars+' characters were observed in paste events. Review the replay to understand context; this is not an authorship verdict.';
  }else{
    title.textContent='Editing process recorded';
    desc.textContent=state.edits+' document changes and '+state.typed+' typed characters observed. Review the mathematical reasoning and revisions.';
  }
}
function showView(mode){
  const student=mode==='student';
  $('studentView').classList.toggle('hidden',!student);
  $('instructorView').classList.toggle('hidden',student);
  $('studentTab').classList.toggle('active',student);
  $('instructorTab').classList.toggle('active',!student);
  $('studentTab').setAttribute('aria-pressed',String(student));
  $('instructorTab').setAttribute('aria-pressed',String(!student));
  stopPlayback();
  if(!student){renderStats();renderTimeline();renderReplay(state.snapshots.length-1);updateInsight();}
}
function downloadLog(editor){
  const out={
    format:'ProofLab writing process demo 1.0',
    disclaimer:'Descriptive telemetry only. No inference of AI authorship.',
    createdAt:new Date(state.start).toISOString(),
    exportedAt:new Date().toISOString(),
    prompt:"Solve y'(t)+2y(t)=6, y(0)=1 using Laplace transforms; calculate y(1).",
    metrics:{typedCharacters:state.typed,pasteEvents:state.pastes,pastedCharacters:state.pastedChars,editTransactions:state.edits,deleteOperations:state.deletes,pausesOverFiveSeconds:state.pauses,focusChanges:state.focus},
    answer:{html:editor.getHTML(),text:editor.getText(),numericAnswer:$('numericAnswer').value,checkpointChecked:state.checked,submitted:state.submitted},
    timeline:state.events.map(e=>({...e,iso:new Date(e.at).toISOString()})),
    snapshots:state.snapshots.map(s=>({...s,iso:new Date(s.at).toISOString()}))
  };
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='prooflab-session-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

initFixedMath();
const editor=new Editor({
  element:$('editor'),
  extensions:[StarterKit,MathInline],
  content:'<p></p>',
  editorProps:{
    attributes:{'aria-label':'Your mathematical solution','data-placeholder':'Start with the Laplace transform of the differential equation...'}
  },
  onCreate({editor}){
    $('editorStatus').textContent='Ready to write';
    editor.view.dom.addEventListener('beforeinput',(event)=>{
      const now=Date.now();
      if(state.lastInput&&now-state.lastInput>=5000){
        state.pauses++;logEvent('pause','Pause between editing actions: '+Math.round((now-state.lastInput)/1000)+' seconds');
      }
      state.lastInput=now;
      if(event.inputType==='insertText'&&typeof event.data==='string'){
        state.typed+=event.data.length;
        logEvent('typing',event.data.length+' typed characters',event.data.length);
      }else if(event.inputType==='insertParagraph'){
        state.typed+=1;logEvent('typing','New paragraph',1);
      }else if(event.inputType&&event.inputType.startsWith('delete')){
        state.deletes++;logEvent('delete',event.inputType.replace(/([A-Z])/g,' $1').toLowerCase());
      }
    });
    editor.view.dom.addEventListener('paste',(event)=>{
      const pasted=event.clipboardData?.getData('text/plain')||'';
      state.pastes++;state.pastedChars+=pasted.length;
      logEvent('paste','Pasted '+pasted.length+' characters (source not determined)');
    });
  },
  onUpdate({editor}){
    state.edits++;
    if(state.submitted){state.submitted=false;$('submissionBadge').textContent='DRAFT IN PROGRESS';$('submissionBadge').classList.remove('submitted');$('submitBtn').innerHTML='Submit practice attempt <span>↗</span>';}
    $('wordCount').textContent=editor.getText().trim()?editor.getText().trim().split(/\s+/).length:'0';
    $('editorStatus').textContent='Changes tracked locally';
    snapshotContent(editor);renderStats();
  },
  onFocus(){state.focus++;logEvent('focus','Editor received focus');},
  onBlur(){state.focus++;logEvent('blur','Editor lost focus');}
});
function handleToolbar(command){
  if(command==='bold')editor.chain().focus().toggleBold().run();
  if(command==='italic')editor.chain().focus().toggleItalic().run();
  if(command==='bullet')editor.chain().focus().toggleBulletList().run();
  if(command==='ordered')editor.chain().focus().toggleOrderedList().run();
  if(command==='undo')editor.chain().focus().undo().run();
  if(command==='redo')editor.chain().focus().redo().run();
}
document.querySelectorAll('[data-command]').forEach(btn=>{
  btn.addEventListener('mousedown',(e)=>e.preventDefault());
  btn.addEventListener('click',()=>{logEvent('format','Toolbar command: '+btn.dataset.command);handleToolbar(btn.dataset.command);});
});
function refreshToolbar(){
  document.querySelectorAll('[data-command]').forEach(btn=>{
    if(['bold','italic'].includes(btn.dataset.command))btn.classList.toggle('is-active',editor.isActive(btn.dataset.command));
  });
}
editor.on('selectionUpdate',refreshToolbar);editor.on('transaction',refreshToolbar);
$('studentTab').addEventListener('click',()=>showView('student'));
$('instructorTab').addEventListener('click',()=>showView('instructor'));
$('equationBtn').addEventListener('click',()=>{
  $('latexInput').value='y(t)=3-2e^{-2t}';$('latexError').textContent='';
  latexRender($('latexInput').value,$('latexPreview'),true);
  $('equationDialog').showModal();$('latexInput').focus();$('latexInput').select();
});
function previewLatex(){
  try{
    katex.render($('latexInput').value,$('latexPreview'),{throwOnError:true,displayMode:true,trust:false});
    $('latexError').textContent='';return true;
  }catch(err){$('latexPreview').textContent='Invalid expression';$('latexError').textContent=err.message;return false;}
}
$('latexInput').addEventListener('input',previewLatex);
$('closeEquation').addEventListener('click',()=>$('equationDialog').close());
$('cancelEquation').addEventListener('click',()=>$('equationDialog').close());
$('equationForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  if(!previewLatex())return;
  const latex=$('latexInput').value.trim();if(!latex)return;
  $('equationDialog').close();
  logEvent('math','Inserted LaTeX equation ('+latex.length+' characters)');
  editor.chain().focus().insertContent({type:'mathInline',attrs:{latex}}).run();
});
$('checkAnswer').addEventListener('click',()=>{
  const raw=$('numericAnswer').value.trim(),val=Number(raw);
  const feedback=$('checkFeedback');
  feedback.classList.remove('success','error');
  if(!raw||!Number.isFinite(val)){
    feedback.textContent='Enter a valid decimal number first.';feedback.classList.add('error');return;
  }
  const expected=3-2*Math.exp(-2);
  state.checked=true;
  if(Math.abs(val-expected)<=0.005){
    feedback.textContent='✓ Numerical checkpoint correct (to three decimal places). This does not validate the full derivation.';
    feedback.classList.add('success');logEvent('check','Numerical checkpoint within tolerance');
  }else{
    feedback.textContent='Not quite. Recheck your transformed solution and evaluate it at t = 1.';
    feedback.classList.add('error');logEvent('check','Numerical checkpoint did not match expected value');
  }
});
$('submitBtn').addEventListener('click',()=>{
  if(!editor.getText().trim()&&!editor.getHTML().includes('mathInline')&&!editor.getHTML().includes('data-math-inline')){
    $('submitMessage').textContent='Write at least one step before submitting.';$('submitMessage').style.color='#b66d34';return;
  }
  state.submitted=true;
  $('submitMessage').textContent='Practice attempt saved in this browser session. Open Instructor insights to inspect the writing record.';
  $('submitMessage').style.color='#008f78';
  $('submitBtn').textContent='✓ Submitted';
  $('submissionBadge').textContent='PRACTICE SUBMITTED';
  $('submissionBadge').classList.add('submitted');
  logEvent('submit','Student submitted the current practice answer');
});
$('exportBtn').addEventListener('click',()=>downloadLog(editor));
$('reportExportBtn').addEventListener('click',()=>downloadLog(editor));
$('replaySlider').addEventListener('input',(e)=>{stopPlayback();renderReplay(Number(e.target.value));});
$('playReplay').addEventListener('click',()=>{
  if(state.playback){stopPlayback();return;}
  if(state.snapshots.length<2)return;
  let current=Number($('replaySlider').value);
  if(current>=state.snapshots.length-1)current=0;
  renderReplay(current);
  $('playReplay').textContent='Ⅱ';$('playReplay').setAttribute('aria-label','Pause replay');
  state.playback=setInterval(()=>{
    current++;
    if(current>=state.snapshots.length){stopPlayback();return;}
    renderReplay(current);
  },380);
});
document.querySelectorAll('.rubric-check').forEach(box=>box.addEventListener('change',()=>{
  const score=[...document.querySelectorAll('.rubric-check:checked')].reduce((total,b)=>total+Number(b.dataset.points),0);
  $('rubricScore').textContent=score;
  $('rubricTrack').style.width=score+'%';
}));
$('resetBtn').addEventListener('click',()=>{
  if(!confirm('Reset the demo? The local writing history, answer, and rubric selections will be cleared.'))return;
  stopPlayback();state.resetting=true;editor.commands.clearContent();
  state.start=Date.now();state.lastInput=0;state.typed=0;state.pastes=0;state.pastedChars=0;state.edits=0;state.deletes=0;state.pauses=0;state.focus=0;state.checked=false;state.submitted=false;
  state.events=[];state.snapshots=[{at:state.start,html:'<p></p>',text:'',reason:'Initial state'}];
  state.resetting=false;
  $('numericAnswer').value='';$('checkFeedback').textContent='Enter a value to test the numerical checkpoint. The full mathematical derivation is not automatically graded.';$('checkFeedback').classList.remove('success','error');
  $('submitMessage').textContent='';$('editorStatus').textContent='Ready to write';
  $('wordCount').textContent='0';$('submitBtn').innerHTML='Submit practice attempt <span>↗</span>';
  $('submissionBadge').classList.remove('submitted');$('submissionBadge').textContent='DRAFT IN PROGRESS';
  document.querySelectorAll('.rubric-check').forEach(b=>b.checked=false);
  $('rubricScore').textContent='0';$('rubricTrack').style.width='0';
  renderStats();renderActivity();renderTimeline();renderReplay(0);updateInsight();updateClock();showView('student');
});
updateClock();setInterval(updateClock,1000);renderReplay(0);renderStats();renderActivity();
