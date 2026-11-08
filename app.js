const APP_VERSION = '3.5';
const $ = id => document.getElementById(id);
const SAVE_KEY = 'wordgrove-v4-save';
const LETTER_HINT_COST = 25, DEFINITION_HINT_COST = 15, DOUBLE_HINT_COST = 40;
const WORD_REWARD = 5, LEVEL_REWARD = 20;
const TWO_LETTER_WORDS = new Set('am an as at be by do go he if in is it me my no of oh on or ox so to up us we'.split(' '));
let levels=[], dictionary=new Set(), definitions={}, level=0, rack=[], picked=[], solved=new Set(), revealed={}, extras=new Set(), selectedWord=null;
let toastTimer, pointerActive=false, pointerId=null, dragged=false, startPoint=null, audioCtx=null, musicTimer=null, musicOn=false, effectsOn=true, revealMode=false, audioWasPlaying=false, completionShown=false, wheelObserver=null, boardObserver=null;
const freshState=()=>({currentLevel:0,unlockedLevel:0,coins:50,solvedByLevel:{},revealedByLevel:{},extrasByLevel:{}});
let state=loadState();
function loadState(){try{const p=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return p?{...freshState(),...p,coins:Math.max(0,+p.coins||0)}:freshState()}catch{return freshState()}}
function saveState(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch{}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function say(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1700)}
function currentWord(){return picked.map(i=>rack[i]).join('')}
function levelNo(){return Math.min(Math.max(state.currentLevel,state.unlockedLevel),levels.length-1)+1}
function updateCoins(){$('homeCoins').textContent=state.coins;$('gameCoins').textContent=state.coins}
function updateHome(){$('homeLevel').textContent=levelNo().toLocaleString();updateCoins();$('homeWords').textContent=Object.values(state.solvedByLevel).reduce((n,a)=>n+(a||[]).length,0).toLocaleString()}
function showHome(){document.body.classList.remove('in-game');$('gameScreen').hidden=true;$('homeScreen').hidden=false;$('overlay').classList.remove('show');updateHome()}
function startGame(){document.body.classList.add('in-game');level=Math.min(Math.max(state.currentLevel,0),state.unlockedLevel,levels.length-1);state.currentLevel=level;if((state.solvedByLevel[level]||[]).length===levels[level].words.length){state.unlockedLevel=Math.min(level+1,levels.length-1);level=state.unlockedLevel;state.currentLevel=level} $('homeScreen').hidden=true;$('gameScreen').hidden=false;renderGame();saveState()}
function persistLevel(){state.solvedByLevel[level]=[...solved];state.revealedByLevel[level]=revealed;state.extrasByLevel[level]=[...extras];state.currentLevel=level;saveState()}
function renderGame(){
 const data=levels[level]; if(!data)return;
 completionShown=false; rack=data.letters.slice(); picked=[]; solved=new Set(state.solvedByLevel[level]||[]); revealed=state.revealedByLevel[level]||{}; extras=new Set(state.extrasByLevel[level]||[]); selectedWord=null;
 const stage=stageForLevel(level);
 $('levelname').textContent=`${stage.name} · ${level+1}`;
 document.body.dataset.stage=stage.key;
 document.body.className=`stage-${stage.key} in-game`;
 $('levelsub').textContent=`${rack.length} tiles · ${data.words.length} words`;
 if($('status')) $('status').textContent=`${solved.size} / ${data.words.length} words`;
 $('current').textContent='';
 const board=$('board'), wheel=$('wheel');
 board.replaceChildren(); wheel.replaceChildren();
 updateCoins(); persistLevel();
 // Layout must settle before measuring board/wheel
 const paint=()=>{renderCrossword();drawWheel();};
 requestAnimationFrame(()=>requestAnimationFrame(paint));
 // Extra fallback paints for slow Android WebView layout
 setTimeout(paint, 50);
 setTimeout(paint, 200);
 if(!wheelObserver && 'ResizeObserver' in window){
  wheelObserver=new ResizeObserver(()=>{if(!$('gameScreen').hidden && rack.length)drawWheel()});
  wheelObserver.observe(wheel);
 }
 if(!boardObserver && 'ResizeObserver' in window){
  boardObserver=new ResizeObserver(()=>{if(!$('gameScreen').hidden && levels[level])renderCrossword()});
  boardObserver.observe(board);
 }
}
function renderCrossword(){
 const data=levels[level];
 if(!data||$('gameScreen').hidden)return;
 const layout=data.layout, board=$('board');
 const parentWidth=board.parentElement.clientWidth||$('gameScreen').clientWidth||window.innerWidth||320;
 const gap=3;
 const boardHeightLimit=window.innerHeight<=740?0.32:0.38;
 let cellSize=Math.max(14, Math.min(
   (parentWidth - gap*(layout.width-1)) / layout.width,
   (window.innerHeight * boardHeightLimit - gap*(layout.height-1)) / layout.height
 ));
 // If still absurdly small, force a usable default and retry shortly
 if(cellSize < 14 || !isFinite(cellSize)){
  cellSize = 18;
  requestAnimationFrame(()=>requestAnimationFrame(renderCrossword));
 }
 board.innerHTML='';
 board.style.gridTemplateColumns=`repeat(${layout.width}, minmax(0,1fr))`;
 board.style.gridTemplateRows=`repeat(${layout.height}, minmax(0,1fr))`;
 board.style.setProperty('--cw', layout.width);
 board.style.setProperty('--ch', layout.height);
 board.style.setProperty('--board-ratio', `${layout.width}/${layout.height}`);
 board.style.width=`${Math.floor(cellSize*layout.width + gap*(layout.width-1))}px`;
 board.style.height=`${Math.floor(cellSize*layout.height + gap*(layout.height-1))}px`;
 board.style.visibility='visible';
 board.style.opacity='1';

 const cells=new Map();
 for(const e of layout.entries){
  for(let i=0;i<e.word.length;i++){
   const x=e.x+(e.dir==='H'?i:0), y=e.y+(e.dir==='V'?i:0), key=`${x},${y}`;
   if(!cells.has(key)) cells.set(key,[]);
   cells.get(key).push({word:e.word,index:i});
  }
 }
 const solvedLetters=new Map();
 for(const e of layout.entries){
  if(solved.has(e.word)){
   for(let i=0;i<e.word.length;i++){
    const x=e.x+(e.dir==='H'?i:0), y=e.y+(e.dir==='V'?i:0);
    solvedLetters.set(`${x},${y}`, e.word[i]);
   }
  } else {
   for(const i of (revealed[e.word]||[])){
    const x=e.x+(e.dir==='H'?i:0), y=e.y+(e.dir==='V'?i:0);
    solvedLetters.set(`${x},${y}`, e.word[i]);
   }
  }
 }
 for(let y=0;y<layout.height;y++){
  for(let x=0;x<layout.width;x++){
   const key=`${x},${y}`, entries=cells.get(key);
   if(!entries) continue;
   const b=document.createElement('button');
   b.type='button';
   b.className='cross-cell';
   b.dataset.x=x; b.dataset.y=y;
   b.style.gridColumn=String(x+1);
   b.style.gridRow=String(y+1);
   b.textContent=(solvedLetters.get(key)||'').toUpperCase();
   const words=entries.map(e=>e.word);
   if(words.some(w=>solved.has(w))) b.classList.add('cross-solved');
   if(words.includes(selectedWord)) b.classList.add('cross-selected');
   if(revealMode && words.includes(selectedWord)) b.classList.add('reveal-pulse');
   if(entries.some(e=>(revealed[e.word]||[]).includes(e.index) && !solved.has(e.word))) b.classList.add('cross-revealed');
   b.addEventListener('click',()=>selectCrosswordCell(x,y));
   board.append(b);
  }
 }
 if($('status')) $('status').textContent=`${solved.size} / ${data.words.length} words`;
 updateSelectedWord();
}
function selectCrosswordCell(x,y){
 const entries=levels[level].layout.entries.filter(e=>{
  const dx=x-e.x, dy=y-e.y;
  return e.dir==='H' ? (dy===0 && dx>=0 && dx<e.word.length) : (dx===0 && dy>=0 && dy<e.word.length);
 });
 if(!entries.length) return;

 if(revealMode){
  if(!selectedWord){ say('Select a word first'); return; }
  const entry=entries.find(e=>e.word===selectedWord);
  if(!entry){ say('Tap a square in the selected word'); return; }
  const index=entry.dir==='H' ? x-entry.x : y-entry.y;
  if(solved.has(selectedWord)){ say('That word has already been revealed!'); return; }
  if((revealed[selectedWord]||[]).includes(index)){ say('That letter is already revealed'); return; }
  if(state.coins<LETTER_HINT_COST){ say(`You need ${LETTER_HINT_COST} coins`); revealMode=false; return; }
  state.coins-=LETTER_HINT_COST;
  revealed[selectedWord]=[...(revealed[selectedWord]||[]), index];
  revealMode=false;
  persistLevel(); renderCrossword(); updateCoins();
  playEffect('success');
  say(`Letter revealed · −${LETTER_HINT_COST} coins`);
  return;
 }

 // Toggle off if tapping the already-selected word again
 const onSelected = entries.some(e=>e.word===selectedWord);
 if(onSelected && selectedWord){
  selectedWord=null;
  renderCrossword();
  return;
 }

 let next=entries.find(v=>!solved.has(v.word)) || entries[0];
 selectedWord=next.word;
 renderCrossword();
}
function updateSelectedWord(){const w=selectedWord;$('selectedClue').textContent=revealMode?'Choose a letter square to reveal':w?`Selected word · ${w.length} letters`:'Tap a crossword word';}
function drawWheel(){
 const wheel=$('wheel');
 if(!$('gameScreen') || $('gameScreen').hidden || !rack.length) return;
 const rect=wheel.getBoundingClientRect();
 if(rect.width < 40 || rect.height < 40){
  // Not laid out yet — retry
  requestAnimationFrame(drawWheel);
  return;
 }
 wheel.replaceChildren();
 wheel.style.visibility='visible';
 wheel.style.opacity='1';
 const n=rack.length;
 const radius=Math.min(rect.width, rect.height) * (n>6 ? 0.36 : 0.34);
 for(let i=0;i<n;i++){
  const b=document.createElement('button');
  b.type='button';
  b.className='letter' + (picked.includes(i) ? ' selected' : '');
  b.textContent=rack[i].toUpperCase();
  const angle=-Math.PI/2 + i*2*Math.PI/n;
  b.style.left=`${50 + Math.cos(angle)*radius/rect.width*100}%`;
  b.style.top=`${50 + Math.sin(angle)*radius/rect.height*100}%`;
  b.dataset.index=i;
  // Ensure letters are painted even if CSS is slow
  b.style.visibility='visible';
  b.style.opacity='1';
  wheel.append(b);
 }
}
function selectLetter(i){if(!Number.isInteger(i)||picked.includes(i))return;picked.push(i);playEffect('letter');updateCurrent()}
function updateCurrent(){$('current').textContent=currentWord().toUpperCase();[...$('wheel').children].forEach((b,i)=>b.classList.toggle('selected',picked.includes(i)))}
function clearSelection(){picked=[];updateCurrent()}
function coinRewardForExtra(word){return word.length<=2?1:word.length===3?2:word.length===4?3:word.length===5?4:5}
function canMakeFromRack(word){const available={};for(const c of rack)available[c]=(available[c]||0)+1;for(const c of word){if(!available[c])return false;available[c]--}return true}
function submit(){
 const w=currentWord().toLowerCase();
 try{
  if(w.length<2){ say('Swipe at least two letters'); return; }
  if(!canMakeFromRack(w)){ say('Those letters are not available'); return; }
  if(levels[level].words.includes(w)){
   if(solved.has(w)){ say('Already found'); return; }
   solveWord(w,true);
   return;
  }
  if(dictionary.has(w) || TWO_LETTER_WORDS.has(w)){
   if(extras.has(w)){ say('Already in your extra words list'); return; }
   extras.add(w);
   const reward=coinRewardForExtra(w);
   state.coins+=reward;
   persistLevel(); updateCoins();
   say(`Extra word! +${reward} coin${reward===1?'':'s'}`);
   playEffect('success');
   return;
  }
  say('Not in this level or the English word list');
 } finally { clearSelection(); }
}
function solveWord(w,reward=true){if(solved.has(w)||completionShown)return;solved.add(w);if(reward)state.coins+=WORD_REWARD;persistLevel();renderCrossword();updateCoins();playEffect('success');if(solved.size>=levels[level].words.length){finishLevel()}else say(`+${WORD_REWARD} coins · Well done!`)}
function finishLevel(){if(completionShown||solved.size<levels[level].words.length)return;completionShown=true;const final=level===levels.length-1;const wordCoins=solved.size*WORD_REWARD;const bonusCoins=[...extras].reduce((n,w)=>n+coinRewardForExtra(w),0);state.coins+=LEVEL_REWARD;state.unlockedLevel=Math.max(state.unlockedLevel,Math.min(level+1,levels.length-1));persistLevel();updateCoins();const points=wordCoins+LEVEL_REWARD+bonusCoins;$('modal').innerHTML=`<div class="level-finish"><div class="finish-leaf">✦</div><h2>${final?'All levels complete!':'Level complete!'}</h2><p>Beautifully done. The next part of your adventure awaits.</p><div class="stats"><div><strong>+${points}</strong><span>POINTS GAINED</span></div><div><strong>${extras.size}</strong><span>BONUS WORDS</span></div></div><p class="finish-detail">${wordCoins} word points · ${LEVEL_REWARD} level bonus${bonusCoins?` · ${bonusCoins} bonus-word coins`:''}</p><button class="action primary" id="next">${final?'Return to menu':`Continue to ${stageForLevel(level+1).name} · ${level+2} →`}</button></div>`;$('overlay').classList.add('show');$('next').onclick=()=>{$('overlay').classList.remove('show');if(final){showHome();return}state.currentLevel=Math.min(level+1,levels.length-1);saveState();level=state.currentLevel;renderGame()}}
async function getDefinition(word){
 const key=String(word).toLowerCase();
 if(definitions[key]){
  const v=definitions[key];
  return Array.isArray(v) ? v : [v];
 }
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),9000);
  const r=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`,{signal:controller.signal});
  clearTimeout(timer);
  if(!r.ok) throw new Error('No definition');
  const data=await r.json();
  const parts=[];
  for(const entry of data){
   for(const meaning of entry.meanings||[]){
    const pos=meaning.partOfSpeech ? `(${meaning.partOfSpeech}) ` : '';
    for(const def of meaning.definitions||[]){
     if(def.definition){
      const line=pos+def.definition;
      if(!parts.includes(line)) parts.push(line);
     }
    }
   }
  }
  const value=parts.slice(0,4); // up to 4 senses
  if(value.length){
   definitions[key]=value;
   try{ localStorage.setItem('wordgrove-definitions', JSON.stringify(definitions)); }catch{}
   return value;
  }
 }catch{}
 return ['Definition is not available offline yet. Open this word while connected to the internet and it will be saved for next time.'];
}

function openWordList(){const words=[...new Set(Object.values(state.solvedByLevel).flatMap(a=>a||[]))].sort();showListModal('Words found',words,'All puzzle words you have solved across your adventure.');}
function openExtras(){const words=[...extras].sort();showListModal('Bonus words',words,'Bonus English words found that are not part of this crossword.');}
async function showListModal(title,words,subtitle){$('modal').innerHTML=`<h2>${esc(title)}</h2><p>${esc(subtitle)}</p><div class="word-list" id="wordListBody">${words.length?words.map(w=>`<article class="word-definition"><strong>${esc(w.toUpperCase())}</strong><span>Loading definition…</span></article>`).join(''):'<p>No words yet. Keep playing!</p>'}</div><button class="action primary" id="closemodal">Close</button>`;$('overlay').classList.add('show');$('closemodal').onclick=()=>$('overlay').classList.remove('show');const body=$('wordListBody');await Promise.all(words.map(async w=>{const def=await getDefinition(w);const row=[...body.querySelectorAll('.word-definition')].find(el=>el.querySelector('strong')?.textContent===w.toUpperCase());if(row)row.querySelector('span').textContent=def}))}
async function definitionHint(){
 const w=selectedWord;
 if(!w){ say('Select a word in the crossword first'); return; }
 if(solved.has(w)){ say('That word has already been revealed!'); return; }
 if(state.coins<DEFINITION_HINT_COST){ say(`You need ${DEFINITION_HINT_COST} coins`); return; }
 state.coins-=DEFINITION_HINT_COST;
 updateCoins(); persistLevel();
 playEffect('success');
 const defs=await getDefinition(w);
 const body=defs.map((d,i)=>`<p class="def-line"><strong>${i+1}.</strong> ${esc(d)}</p>`).join('');
 showModal(`Definition · ${w.toUpperCase()}`, body);
}
function revealOne(){
 revealMode=true;
 say('Tap a square in a selected word to reveal its letter');
 updateSelectedWord();
 playEffect('button');
}
function revealTwo(){
 const unsolved=levels[level].words.filter(w=>!solved.has(w));
 const options=[];
 for(const w of unsolved)
  for(let i=0;i<w.length;i++)
   if(!(revealed[w]||[]).includes(i)) options.push({w,i});
 if(options.length<1){ say('No hidden letters remain'); return; }
 if(state.coins<DOUBLE_HINT_COST){ say(`You need ${DOUBLE_HINT_COST} coins`); return; }
 state.coins-=DOUBLE_HINT_COST;
 const n=Math.min(2, options.length);
 for(let k=0;k<n;k++){
  const ix=Math.floor(Math.random()*options.length);
  const p=options.splice(ix,1)[0];
  revealed[p.w]=[...(revealed[p.w]||[]), p.i];
 }
 persistLevel(); renderCrossword(); updateCoins();
 playEffect('success');
 say(`${n} letter${n>1?'s':''} revealed · −${DOUBLE_HINT_COST} coins`);
}
function openHints(){showModal('Choose a hint',`<div class="hint-options"><button class="action" id="oneHint">Reveal one letter · ${LETTER_HINT_COST} coins</button><button class="action" id="defHint">Show selected word definition · ${DEFINITION_HINT_COST} coins</button><button class="action" id="twoHint">Reveal two random letters · ${DOUBLE_HINT_COST} coins</button></div>`);$('modal').querySelector('#oneHint').onclick=()=>{$('overlay').classList.remove('show');revealOne()};$('modal').querySelector('#defHint').onclick=()=>{$('overlay').classList.remove('show');definitionHint()};$('modal').querySelector('#twoHint').onclick=()=>{$('overlay').classList.remove('show');revealTwo()}}
function shuffle(){for(let i=rack.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rack[i],rack[j]]=[rack[j],rack[i]]}picked=[];drawWheel();updateCurrent()}
function showModal(title,body){
 $('modal').innerHTML=`<h2>${esc(title)}</h2><div class="modal-body">${body}</div><button class="action primary" id="closemodal">Got it</button><div class="app-version">Wordgrove v${APP_VERSION}</div>`;
 $('overlay').classList.add('show');
 $('closemodal').onclick=()=>$('overlay').classList.remove('show');
}
function handleDown(e){const b=e.target.closest('.letter');if(!b||pointerActive)return;e.preventDefault();pointerActive=true;pointerId=e.pointerId;dragged=false;startPoint={x:e.clientX,y:e.clientY};try{$('wheel').setPointerCapture(e.pointerId)}catch{}selectLetter(+b.dataset.index)}
function handleMove(e){if(!pointerActive||e.pointerId!==pointerId)return;const dx=e.clientX-startPoint.x,dy=e.clientY-startPoint.y;if(Math.hypot(dx,dy)>8)dragged=true;const t=document.elementFromPoint(e.clientX,e.clientY),b=t?.closest?.('.letter');if(b&&$('wheel').contains(b))selectLetter(+b.dataset.index)}
function handleUp(e){if(!pointerActive||e.pointerId!==pointerId)return;const shouldSubmit=e.type==='pointerup'&&picked.length>=2;pointerActive=false;pointerId=null;startPoint=null;if(shouldSubmit)submit();else clearSelection()}

const STAGES=[['Meadow','meadow'],['Field','field'],['Moonlit Mountain Forest','moonlit-forest'],['Waterfall','waterfall'],['Autumn Grove','autumn-grove'],['Crystal Lake','crystal-lake'],['Misty Highlands','misty-highlands'],['Sunset Valley','sunset-valley']];
function stageForLevel(n){const stageIndex=Math.floor(n/25);const base=STAGES[stageIndex%STAGES.length];const cycle=Math.floor(stageIndex/STAGES.length);const name=cycle?`${base[0]} ${cycle+1}`:base[0];return {name,key:base[1],first:stageIndex*25,last:Math.min(stageIndex*25+24,levels.length-1)}}
function openLevels(){const cards=[];const count=Math.ceil(levels.length/25);for(let i=0;i<count;i++){const base=STAGES[i%STAGES.length],cycle=Math.floor(i/STAGES.length),name=cycle?`${base[0]} ${cycle+1}`:base[0],first=i*25,last=Math.min(first+24,levels.length-1),open=first<=state.unlockedLevel;cards.push(`<button class="stage-card" data-stage-index="${i}" ${open?'':'disabled'}><strong>${esc(name)}</strong><span>Levels ${first+1}–${last+1} · ${open?'Unlocked':'Locked'}</span></button>`)}showModal('Choose a stage',`<div class="stage-grid">${cards.join('')}</div>`);$('modal').querySelectorAll('[data-stage-index]').forEach(b=>b.onclick=()=>{const first=Number(b.dataset.stageIndex)*25;state.currentLevel=Math.min(first,levels.length-1);saveState();$('overlay').classList.remove('show');startGame()})}
function openGameMenu(){
 showModal('Game menu',
  `<div class="menu-options">
    <button class="action" id="settingsOpen">♫ Sound settings</button>
    <button class="action" id="levelsOpen">✧ Levels</button>
    <button class="action" id="returnHome">⌂ Return to menu</button>
  </div>
  <div class="app-version">Wordgrove v${APP_VERSION}</div>`);
 const m=$('modal');
 m.querySelector('#settingsOpen').onclick=openSoundSettings;
 m.querySelector('#levelsOpen').onclick=openLevels;
 m.querySelector('#returnHome').onclick=showHome;
}
function openSoundSettings(){showModal('Sound settings',`<div class="menu-options"><button class="action" id="musicToggle">Background music: ${musicOn?'On':'Off'}</button><button class="action" id="effectsToggle">Nature sounds: ${effectsOn?'On':'Off'}</button></div>`);$('modal').querySelector('#musicToggle').onclick=()=>{toggleMusic();openSoundSettings()};$('modal').querySelector('#effectsToggle').onclick=()=>{toggleEffects();openSoundSettings()}}

// Original, gentle synthesized ambience and tiny nature-inspired interaction sounds.
function audio(){if(!audioCtx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;audioCtx=new C()}if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}
function playEffect(kind='button'){if(!effectsOn)return;const c=audio();if(!c)return;const now=c.currentTime;const osc=c.createOscillator(),gain=c.createGain();osc.type='sine';const stageTone={'meadow':0,'field':-90,'moonlit-forest':-180,'waterfall':140,'autumn-grove':-40,'crystal-lake':90,'misty-highlands':-120,'sunset-valley':60}[document.body.dataset.stage]||0;const f=(kind==='success'?1250:kind==='letter'?1450:kind==='button'?820:560)+stageTone;osc.frequency.setValueAtTime(f,now);osc.frequency.exponentialRampToValueAtTime(kind==='button'?f*.48:f*1.65,now+(kind==='button'?.18:.11));gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='success'?.035:.025,now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+(kind==='button'?.22:.17));osc.connect(gain).connect(c.destination);osc.start(now);osc.stop(now+(kind==='button'?.23:.18));if(kind==='success'){for(let j=0;j<2;j++){const o=c.createOscillator(),g=c.createGain(),t=now+.06+j*.14;o.type='sine';o.frequency.setValueAtTime(1500-j*180,t);o.frequency.exponentialRampToValueAtTime(2100-j*180,t+.09);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.018,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.18);o.connect(g).connect(c.destination);o.start(t);o.stop(t+.19)}}}
let musicChord=0;function musicNote(){const c=audio();if(!c)return;const now=c.currentTime;const themes={'meadow':[[196,246.94,293.66,369.99],[164.81,196,246.94,329.63],[174.61,220,261.63,349.23]],'field':[[174.61,220,261.63,329.63],[146.83,196,246.94,293.66],[164.81,207.65,246.94,329.63]],'moonlit-forest':[[146.83,174.61,220,261.63],[130.81,164.81,196,246.94],[146.83,185,220,277.18]],'waterfall':[[220,261.63,329.63,392],[196,246.94,293.66,369.99],[174.61,220,293.66,349.23]],'autumn-grove':[[164.81,207.65,246.94,311.13],[146.83,185,220,277.18],[155.56,196,233.08,293.66]],'crystal-lake':[[207.65,261.63,311.13,415.3],[185,233.08,277.18,369.99],[196,246.94,293.66,392]],'misty-highlands':[[174.61,207.65,261.63,311.13],[155.56,196,233.08,311.13],[164.81,220,261.63,329.63]],'sunset-valley':[[185,233.08,277.18,349.23],[164.81,207.65,246.94,329.63],[174.61,220,261.63,349.23]]};const progression=themes[document.body.dataset.stage]||themes.meadow;const notes=progression[musicChord++%progression.length];for(let i=0;i<notes.length;i++){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=notes[i];g.gain.setValueAtTime(.0001,now);g.gain.linearRampToValueAtTime(.009,now+1.4);g.gain.linearRampToValueAtTime(.0001,now+5.8);o.connect(g).connect(c.destination);o.start(now+i*.2);o.stop(now+5.9)}}
function stopMusicForBackground(){clearInterval(musicTimer);musicTimer=null;if(audioCtx&&audioCtx.state==='running')audioCtx.suspend().catch(()=>{})}
function resumeMusic(){if(!musicOn||document.hidden)return;const c=audio();if(c&&c.state==='suspended')c.resume().catch(()=>{});if(!musicTimer){musicNote();musicTimer=setInterval(musicNote,5700)}}
function toggleMusic(){musicOn=!musicOn;if(musicOn){audio();musicNote();clearInterval(musicTimer);musicTimer=setInterval(musicNote,5700)}else{stopMusicForBackground()}}
function toggleEffects(){effectsOn=!effectsOn}
$('playBtn').addEventListener('click',startGame);$('homeMenuBtn').addEventListener('click',openGameMenu);$('gameMenuBtn').addEventListener('click',openGameMenu);$('levelsBtn').addEventListener('click',openLevels);$('shuffle').addEventListener('click',shuffle);$('hint').addEventListener('click',openHints);$('wordListBtn').addEventListener('click',openWordList);$('extrasBtn').addEventListener('click',openExtras);$('homeHelp').addEventListener('click',()=>showModal('How to play','Swipe across the letter wheel to spell words. Tap a crossword word to select it for definition hints or a letter reveal. Solve every crossword word to finish a level. Bonus words earn coins.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMusicForBackground();else resumeMusic()});window.addEventListener('pagehide',stopMusicForBackground);window.addEventListener('pageshow',()=>{if(!document.hidden)resumeMusic()});
document.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('.letter'))playEffect('button')});
$('wheel').addEventListener('pointerdown',handleDown);document.addEventListener('pointermove',handleMove,{passive:false});document.addEventListener('pointerup',handleUp);document.addEventListener('pointercancel',handleUp);
async function boot(){try{const [lr,dr,df]=await Promise.all([fetch('./levels.json'),fetch('./dictionary.json'),fetch('./definitions.json').catch(()=>null)]);if(!lr.ok||!dr.ok)throw Error('Puzzle files unavailable');levels=await lr.json();dictionary=new Set(await dr.json());if(df?.ok)definitions=await df.json();try{definitions={...definitions,...JSON.parse(localStorage.getItem('wordgrove-definitions')||'{}')}}catch{}state.currentLevel=Math.min(state.currentLevel,levels.length-1);state.unlockedLevel=Math.min(state.unlockedLevel,levels.length-1);updateHome();showHome();const hv=$('homeVersion');if(hv)hv.textContent=`Wordgrove v${APP_VERSION}`;if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}catch(e){$('homeScreen').innerHTML='<div class="hero"><h1>Wordgrove</h1><p>The puzzle library could not be loaded. Connect to the internet once, then refresh.</p></div>'}}
window.addEventListener('resize',()=>{if(levels.length&&!$('gameScreen').hidden){renderCrossword();drawWheel()}});boot();
