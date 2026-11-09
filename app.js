const APP_VERSION = '3.6.0';
const $ = id => document.getElementById(id);
const SAVE_KEY = 'wordgrove-v4-save';
const LETTER_HINT_COST = 45, DEFINITION_HINT_COST = 30, DOUBLE_HINT_COST = 75, WORD_REVEAL_COST = 90;
const WORD_REWARD = 4, LEVEL_REWARD = 12;
const TWO_LETTER_WORDS = new Set('am an as at be by do go he if in is it me my no of oh on or ox so to up us we'.split(' '));
let levels=[], dictionary=new Set(), definitions={}, level=0, rack=[], picked=[], solved=new Set(), revealed={}, extras=new Set(), selectedWord=null;
let toastTimer, pointerActive=false, pointerId=null, dragged=false, startPoint=null, audioCtx=null, musicTimer=null, musicOn=false, effectsOn=true, revealMode=false, audioWasPlaying=false, completionShown=false, wheelObserver=null, boardObserver=null, combo=0, comboAt=0, mode='campaign', quiet=false;
const freshState=()=>({currentLevel:0,unlockedLevel:0,coins:50,solvedByLevel:{},revealedByLevel:{},extrasByLevel:{},dailyDate:'',dailyStreak:0,dailyDone:'',quiet:false});
let state=loadState();
function loadState(){try{const p=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return p?{...freshState(),...p,coins:Math.max(0,+p.coins||0)}:freshState()}catch{return freshState()}}
function saveState(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch{}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function say(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1700)}
function currentWord(){return picked.map(i=>rack[i]).join('')}
function levelNo(){const cap=Math.max(levels.length-1,0);return Math.min(Math.max(state.currentLevel||0,0),cap)+1}
function updateCoins(){$('homeCoins').textContent=state.coins;$('gameCoins').textContent=state.coins}
function updateHome(){$('homeLevel').textContent=levelNo().toLocaleString();updateCoins();$('homeWords').textContent=Object.values(state.solvedByLevel).reduce((n,a)=>n+(a||[]).length,0).toLocaleString();const hv=$('homeVersion');if(hv)hv.textContent=`Wordgrove v${APP_VERSION}`;}
function showHome(){document.body.classList.remove('in-game');mode='campaign';$('gameScreen').hidden=true;$('homeScreen').hidden=false;$('overlay').classList.remove('show','finish-open');updateHome();renderWotd()}
function repairProgress(){if(!levels.length)return;let highest=Math.min(state.unlockedLevel||0,levels.length-1);for(const [k,arr] of Object.entries(state.solvedByLevel||{})){const i=+k;const lv=levels[i];if(lv&&(arr||[]).length>=(lv.words||[]).length)highest=Math.max(highest,Math.min(i+1,levels.length-1))}state.unlockedLevel=Math.max(0,Math.min(highest,levels.length-1));state.currentLevel=Math.min(Math.max(state.currentLevel||0,0),state.unlockedLevel);while(levels[state.currentLevel]&&(state.solvedByLevel[state.currentLevel]||[]).length>=(levels[state.currentLevel].words||[]).length&&state.currentLevel<state.unlockedLevel)state.currentLevel++;saveState()}
function startGame(force){document.body.classList.add('in-game');mode='campaign';repairProgress();const cap=Math.min(state.unlockedLevel,levels.length-1);let next=typeof force==='number'?force:state.currentLevel;next=Math.min(Math.max(next,0),cap);level=next;state.currentLevel=level;$('homeScreen').hidden=true;$('gameScreen').hidden=false;renderGame();saveState()}
function persistLevel(){if(mode!=='campaign'){saveState();return}state.solvedByLevel[level]=[...solved];state.revealedByLevel[level]=revealed;state.extrasByLevel[level]=[...extras];state.currentLevel=level;saveState()}
function renderGame(){
 const data=levels[level]; if(!data)return;
 completionShown=false; revealMode=false; rack=data.letters.slice(); picked=[]; if(mode==='campaign'){solved=new Set(state.solvedByLevel[level]||[]);revealed=state.revealedByLevel[level]||{};extras=new Set(state.extrasByLevel[level]||[])} selectedWord=null;
 const stage=stageForLevel(level);
 $('levelname').textContent=`${stage.name} · ${level+1}`;
 document.body.dataset.stage=stage.key;
 document.body.className=`stage-${stage.key} in-game`;
 const within=level-stage.first+1, span=stage.last-stage.first+1;
 $('levelsub').textContent=`${within} / ${span} in ${stage.name} · ${rack.length} tiles`;
 const bar=$('stageBar'); if(bar) bar.style.width=`${Math.round(within/span*100)}%`;
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
 const data=levels[level];
 if(!data) return;
 const entries=data.layout.entries.filter(e=>{
  const dx=x-e.x, dy=y-e.y;
  return e.dir==='H' ? (dy===0 && dx>=0 && dx<e.word.length) : (dx===0 && dy>=0 && dy<e.word.length);
 });
 if(!entries.length) return;

 if(revealMode){
  if(!selectedWord){
   const pick=entries.find(v=>!solved.has(v.word))||entries[0];
   selectedWord=pick.word;
   renderCrossword();
   say('Now tap a letter in that word to reveal it');
   return;
  }
  const entry=entries.find(e=>e.word===selectedWord);
  if(!entry){
   const pick=entries.find(v=>!solved.has(v.word))||entries[0];
   selectedWord=pick.word;
   renderCrossword();
   return;
  }
  const index=Number(entry.dir==='H' ? x-entry.x : y-entry.y);
  if(solved.has(selectedWord)){ say('That word is already solved'); revealMode=false; renderCrossword(); return; }
  if(letterVisibleAt(selectedWord, index)){ say('That letter is already revealed'); return; }
  if(state.coins<LETTER_HINT_COST){ say(`You need ${LETTER_HINT_COST} coins`); revealMode=false; renderCrossword(); return; }
  state.coins-=LETTER_HINT_COST;
  const have=new Set((revealed[selectedWord]||[]).map(Number));
  have.add(index);
  revealed[selectedWord]=[...have];
  revealMode=false;
  persistLevel(); updateCoins();
  playEffect('success');
  say(`Letter revealed · −${LETTER_HINT_COST} coins`);
  autoCompleteRevealedWords();
  renderCrossword();
  return;
 }

 const onSelected = selectedWord && entries.some(e=>e.word===selectedWord);
 if(onSelected){
  selectedWord=null;
  renderCrossword();
  return;
 }
 const next=entries.find(v=>!solved.has(v.word))||entries[0];
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
 const size=Math.max(46, Math.min(86, (Math.min(rect.width,rect.height)*0.92) / (n>6?2.15:1.85)));
 const inset=size/2+2;
 const rpx=Math.max(8, Math.min(rect.width,rect.height)/2 - inset);
 for(let i=0;i<n;i++){
  const b=document.createElement('button');
  b.type='button';
  b.className='letter' + (picked.includes(i) ? ' selected' : '');
  b.textContent=rack[i].toUpperCase();
  const angle=-Math.PI/2 + i*2*Math.PI/n;
  b.style.width=size+'px'; b.style.height=size+'px'; b.style.fontSize=Math.round(size*0.48)+'px';
  b.style.left=`${50 + Math.cos(angle)*rpx/rect.width*100}%`;
  b.style.top=`${50 + Math.sin(angle)*rpx/rect.height*100}%`;
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

const BONUS_BLOCK=new Set('eal lae lare roat fbi tra stor mfg stra cali la peru doc shiv usa nyc cia nfl nba mlb dna rna gps usb cpu gpu atm irs fda cdc nato ufo aka html http www ids ltd inc apt ave blvd mrs rev stn docu'.split(' '));
const COMMON3=new Set('age ago aid aim air ale all and ant any ape arc are ark arm art ash ask ate awe axe bad bag ban bar bat bay bed bee beg bet bid big bin bit boa bog bow box boy bud bug bun bus but buy cab can cap car cat cob cod cog cop cot cow cry cub cup cut dad dam day den dew did die dig dim din dip dog don dot dry due dug dye ear eat egg ego elf elk elm end era eye fan far fat fed few fig fin fit fix fly fog for fox fry fun gap gas gem get gig gin god got gum gun gut guy had ham has hat hay hen her hid him hip his hit hog hop hot how hub hug hum hut ice ill imp ink inn ire ivy jam jar jaw jet job jog joy jug keg key kid kin kit lab lad lag lap law lay led leg let lid lie lip lit log lot low lug mad man map mat may men met mix mob mom mop mow mud mug nap net new nip nod nor not now nun nut oak oar oat odd off oil old one orb ore our out owe owl own pad pal pan par pat paw pay pea peg pen per pet pie pig pin pit pod pop pot pro pub pug pun pup put rag ram ran rap rat raw ray red rib rid rig rim rip rob rod rot row rub rug rum run rye sad sag sap sat saw say sea set sew she shy sin sip sir sit six ski sky sly son sow soy spa spy sub sum sun tab tad tag tan tap tar tea ten the thy tic tie tin tip toe ton too top tot tow toy try tub tug two urn use van vat vet via vow wad war was wax way web wet who why wig win wit woe won woo wow yak yam yea yen yes yet you zoo'.split(' '));
const BAD_DEF=/\b(abbreviation|acronym|initialism|proper noun|surname|given name|city in|country in|slang|jargon)\b/i;
function bonusAllowed(word, defsText){
 const w=String(word||'').toLowerCase();
 if(BONUS_BLOCK.has(w)) return false;
 if(!/[aeiou]/.test(w)) return false;
 if(defsText && BAD_DEF.test(defsText)) return false;
 if(w.length===2) return TWO_LETTER_WORDS.has(w);
 if(w.length===3) return COMMON3.has(w);
 return w.length>=4;
}

async function lookupEnglishWord(word){
 const key=String(word).toLowerCase();
 if(dictionary.has(key) || TWO_LETTER_WORDS.has(key)) return true;
 const remember=()=>{
  dictionary.add(key);
  try{
   const extra=JSON.parse(localStorage.getItem('wordgrove-extra-words')||'[]');
   if(!extra.includes(key)){ extra.push(key); localStorage.setItem('wordgrove-extra-words', JSON.stringify(extra)); }
  }catch{}
 };
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6000);
  const r=await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(key),{signal:controller.signal});
  clearTimeout(timer);
  if(r.ok){
   const data=await r.json();
   if(Array.isArray(data)&&data.length&&data[0].meanings){const blob=JSON.stringify(data[0].meanings);if(!bonusAllowed(key,blob))return false;remember();return true;}
  }
 }catch(e){}
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6000);
  const r=await fetch('https://api.datamuse.com/words?sp='+encodeURIComponent(key)+'&md=d&max=1',{signal:controller.signal});
  clearTimeout(timer);
  if(r.ok){
   const data=await r.json();
   if(Array.isArray(data)&&data[0]&&data[0].word===key&&Array.isArray(data[0].defs)&&data[0].defs.length){const blob=data[0].defs.join(' ');if(!bonusAllowed(key,blob))return false;remember();return true;}
  }
 }catch(e){}
 return false;
}
async function submit(){
 const w=currentWord().toLowerCase();
 try{
  if(w.length<2){ say('Swipe at least two letters'); return; }
  if(!canMakeFromRack(w)){ say('Those letters are not available'); return; }
  if(levels[level].words.includes(w)){
   if(solved.has(w)){ say('Already found'); return; }
   solveWord(w,true);
   return;
  }
  // Local bonus list first
  resetCombo();
  let okBonus = dictionary.has(w) && bonusAllowed(w,'');
  if(w.length===2) okBonus = TWO_LETTER_WORDS.has(w);
  if(!okBonus && w.length>=3 && bonusAllowed(w,'')){
   say('Checking word…');
   okBonus = await lookupEnglishWord(w);
  }
  if(okBonus && !bonusAllowed(w,'')) okBonus=false;
  if(okBonus){
   if(extras.has(w)){ say('Already in your extra words list'); return; }
   extras.add(w);
   const reward=coinRewardForExtra(w);
   if(mode==='campaign'){state.coins+=reward;persistLevel();updateCoins();}
   say(`Extra word! +${reward} coin${reward===1?'':'s'}`);
   playEffect('success');
   return;
  }
  say('Not in this level or the English word list');
 } finally { clearSelection(); }
}
function letterVisibleAt(word, index){
 index=Number(index);
 if(solved.has(word)) return true;
 const have=new Set((revealed[word]||[]).map(Number));
 if(have.has(index)) return true;
 // Crossing solved words can fill a letter
 const data=levels[level];
 if(!data) return false;
 const entry=data.layout.entries.find(e=>e.word===word);
 if(!entry) return false;
 const x=entry.x+(entry.dir==='H'?index:0);
 const y=entry.y+(entry.dir==='V'?index:0);
 for(const e of data.layout.entries){
  if(e.word===word || !solved.has(e.word)) continue;
  for(let i=0;i<e.word.length;i++){
   const ex=e.x+(e.dir==='H'?i:0), ey=e.y+(e.dir==='V'?i:0);
   if(ex===x && ey===y) return true;
  }
 }
 return false;
}
function autoCompleteRevealedWords(){
 const data=levels[level];
 if(!data||completionShown) return;
 let any=false;
 for(const w of data.words){
  if(solved.has(w)) continue;
  let full=true;
  for(let i=0;i<w.length;i++){
   if(!letterVisibleAt(w,i)){ full=false; break; }
  }
  if(full){
   solveWord(w,true);
   any=true;
   if(completionShown) return;
  }
 }
}
function solveWord(w,reward=true){
 if(solved.has(w)||completionShown) return;
 solved.add(w);
 const extra=reward?comboBonus():0;
 if(reward && mode==='campaign') state.coins+=WORD_REWARD+extra;
 persistLevel(); updateCoins();
 playEffect('success');
 buzz(extra? [12,24,18] : 14);
 if(extra) burst(combo);
 if(solved.size>=levels[level].words.length){
  renderCrossword();
  finishLevel();
 } else {
  // Completing a word may auto-fill crossings
  renderCrossword();
  // Check other words that may now be fully visible
  const data=levels[level];
  for(const other of data.words){
   if(solved.has(other)||completionShown) continue;
   let full=true;
   for(let i=0;i<other.length;i++){
    if(!letterVisibleAt(other,i)){ full=false; break; }
   }
   if(full) solveWord(other,true);
   if(completionShown) return;
  }
  if(!completionShown) say(extra?`Combo x${combo} · +${WORD_REWARD+extra} coins`:`+${WORD_REWARD} coins · Well done!`);
 }
}
function finishLevel(){if(completionShown||solved.size<levels[level].words.length)return;if(mode==='daily'){completionShown=true;const key=todayKey();const prev=state.dailyDone;const y=new Date();y.setDate(y.getDate()-1);const yk=y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');state.dailyStreak = prev===yk ? (state.dailyStreak||0)+1 : 1;state.dailyDone=key;state.coins+=20;saveState();updateCoins();showModal('Daily complete','Streak '+(state.dailyStreak||1)+' · +20 coins. Come back tomorrow.');return}completionShown=true;const final=level===levels.length-1;const wordCoins=solved.size*WORD_REWARD;const bonusCoins=[...extras].reduce((n,w)=>n+coinRewardForExtra(w),0);state.coins+=LEVEL_REWARD;state.unlockedLevel=Math.max(state.unlockedLevel,Math.min(level+1,levels.length-1));persistLevel();updateCoins();const points=wordCoins+LEVEL_REWARD+bonusCoins;$('modal').innerHTML=`<div class="level-finish"><div class="finish-leaf">✦</div><h2>${final?'All levels complete!':'Level complete!'}</h2><p>Beautifully done. The next part of your adventure awaits.</p><div class="stats"><div><strong>+${points}</strong><span>POINTS GAINED</span></div><div><strong>${extras.size}</strong><span>BONUS WORDS</span></div></div><p class="finish-detail">${wordCoins} word points · ${LEVEL_REWARD} level bonus${bonusCoins?` · ${bonusCoins} bonus-word coins`:''}</p><button class="action primary" id="next">${final?'Return to menu':`Continue to ${stageForLevel(level+1).name} · ${level+2} →`}</button></div>`;$('overlay').classList.add('show','finish-open');const coach=coachWords();if(coach.length){$('modal').insertAdjacentHTML('beforeend',`<p class=\"finish-detail\">You could also have made: ${coach.map(esc).join(', ')}</p>`);}$('next').onclick=()=>{$('overlay').classList.remove('show','finish-open');if(final){showHome();return}state.currentLevel=Math.min(level+1,levels.length-1);saveState();level=state.currentLevel;renderGame()}}
async function getDefinition(word){
 const key=String(word).toLowerCase();
 if(definitions[key]){
  const v=definitions[key];
  return Array.isArray(v) ? v.slice(0,4) : [v];
 }
 try{
  const cached=JSON.parse(localStorage.getItem('wordgrove-definitions')||'{}');
  if(cached[key]){
   const v=cached[key];
   definitions[key]=v;
   return Array.isArray(v) ? v.slice(0,4) : [v];
  }
 }catch{}

 const save=(parts)=>{
  if(!parts||!parts.length) return parts;
  definitions[key]=parts;
  try{
   const all=JSON.parse(localStorage.getItem('wordgrove-definitions')||'{}');
   all[key]=parts;
   localStorage.setItem('wordgrove-definitions', JSON.stringify(all));
  }catch{}
  return parts;
 };

 // Source 1: Free Dictionary API
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  const r=await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(key),{signal:controller.signal});
  clearTimeout(timer);
  if(r.ok){
   const ct=(r.headers.get('content-type')||'');
   if(!ct || ct.includes('json')){
    const data=await r.json();
    if(Array.isArray(data)){
     const parts=[];
     for(const entry of data){
      for(const meaning of entry.meanings||[]){
       const pos=meaning.partOfSpeech?`(${meaning.partOfSpeech}) `:'';
       for(const def of meaning.definitions||[]){
        if(def.definition){
         const line=pos+def.definition;
         if(!parts.includes(line)) parts.push(line);
        }
       }
      }
     }
     if(parts.length) return save(parts.slice(0,4));
    }
   }
  }
 }catch(e){}

 // Source 2: Datamuse (often works when the other API is blocked)
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  const r=await fetch('https://api.datamuse.com/words?sp='+encodeURIComponent(key)+'&md=d&max=1',{signal:controller.signal});
  clearTimeout(timer);
  if(r.ok){
   const data=await r.json();
   if(Array.isArray(data)&&data[0]&&Array.isArray(data[0].defs)){
    const parts=[];
    for(const raw of data[0].defs){
     // format: "n\tdefinition text"
     const line=String(raw).replace(/^[a-z]+\t/i,'').trim();
     if(line && !parts.includes(line)) parts.push(line);
    }
    if(parts.length) return save(parts.slice(0,4));
   }
  }
 }catch(e){}

 return ['Definition could not be loaded right now. Try again in a moment — your connection may be fine, but the dictionary service did not respond.'];
}

function openWordList(){const words=[...solved].sort();showListModal('This level',words,'Puzzle words solved on this level only.');}
function openAllWords(){const words=[...new Set(Object.values(state.solvedByLevel).flatMap(a=>a||[]))].sort();showListModal('All words found',words,'Every puzzle word you have solved.');}
function openExtras(){const words=[...extras].sort();showListModal('Bonus words',words,'Bonus English words found that are not part of this crossword.');}
async function showListModal(title,words,subtitle){$('modal').innerHTML=`<h2>${esc(title)}</h2><p>${esc(subtitle)}</p><div class="word-list" id="wordListBody">${words.length?words.map(w=>`<article class="word-definition"><strong>${esc(w.toUpperCase())}</strong><span>Loading definition…</span></article>`).join(''):'<p>No words yet. Keep playing!</p>'}</div><button class="action primary" id="closemodal">Close</button>`;$('overlay').classList.add('show');$('closemodal').onclick=()=>$('overlay').classList.remove('show');const body=$('wordListBody');await Promise.all(words.map(async w=>{const def=await getDefinition(w);const row=[...body.querySelectorAll('.word-definition')].find(el=>el.querySelector('strong')?.textContent===w.toUpperCase());if(row)row.querySelector('span').textContent=def}))}
function spoilerForms(word){
 const w=String(word).toLowerCase();
 const forms=new Set([w]);
 if(w.length>=2){
  forms.add(w+'s'); forms.add(w+'es'); forms.add(w+'ed'); forms.add(w+'ing');
  if(w.endsWith('e')){
   const stem=w.slice(0,-1);
   forms.add(stem+'ed'); forms.add(stem+'ing'); forms.add(stem+'es');
  }
  if(w.endsWith('y') && w.length>2 && !'aeiou'.includes(w[w.length-2])){
   forms.add(w.slice(0,-1)+'ies');
  }
  if(w.length<=4 && !'aeiou'.includes(w[w.length-1]) && 'aeiou'.includes(w[w.length-2]||'')){
   forms.add(w+w[w.length-1]+'ed');
   forms.add(w+w[w.length-1]+'ing');
  }
 }
 return [...forms];
}
function filterSpoilerDefs(word, defs){
 if(!Array.isArray(defs) || !defs.length) return defs||[];
 try{
  const forms=spoilerForms(word);
  const escaped=forms.map(f=>String(f).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const re=new RegExp('\\b(?:'+escaped.join('|')+')\\b','i');
  const safe=defs.filter(d=>!re.test(String(d)));
  return safe.length ? safe : defs;
 }catch(e){
  return defs;
 }
}
async function definitionHint(){
 const w=selectedWord;
 if(!w){ say('Select a word in the crossword first'); return; }
 if(solved.has(w)){ say('That word is already solved'); return; }
 if(state.coins<DEFINITION_HINT_COST){ say(`You need ${DEFINITION_HINT_COST} coins`); return; }
 playEffect('button');
 say('Looking up definition…');
 let defs;
 try{
  defs=filterSpoilerDefs(w, await getDefinition(w));
 }catch(e){
  showModal('Definition hint', '<p class="def-line">Could not load a definition. Please try again.</p>');
  return;
 }
 // Treat the soft-fail messages from getDefinition as failure (don't charge)
 const joined=(defs||[]).join(' ').toLowerCase();
 const failed=!defs || !defs.length || joined.includes('could not be loaded') || joined.includes('not available offline') || joined.includes('no definition saved');
 if(failed){
  showModal('Definition hint', '<p class="def-line">No definition available for this word right now. Your coins were not spent.</p>');
  return;
 }
 state.coins-=DEFINITION_HINT_COST;
 updateCoins(); persistLevel();
 playEffect('success');
 const body=defs.map((d,i)=>`<p class="def-line"><strong>${i+1}.</strong> ${esc(d)}</p>`).join('');
 showModal('Definition hint', body);
}
function revealOne(){
 if(!selectedWord){
  say('Select a crossword word first, then use this hint');
  playEffect('button');
  return;
 }
 if(solved.has(selectedWord)){
  say('That word is already solved');
  return;
 }
 revealMode=true;
 say('Tap a letter square in the selected word to reveal it');
 updateSelectedWord();
 playEffect('button');
 renderCrossword();
}
function revealTwo(){
 const unsolved=levels[level].words.filter(w=>!solved.has(w));
 const options=[];
 for(const w of unsolved){
  for(let i=0;i<w.length;i++){
   // Skip anything already on the board (hint reveal OR crossing solved word)
   if(!letterVisibleAt(w,i)) options.push({w,i});
  }
 }
 if(options.length<1){ say('No hidden letters remain'); return; }
 if(state.coins<DOUBLE_HINT_COST){ say(`You need ${DOUBLE_HINT_COST} coins`); return; }
 state.coins-=DOUBLE_HINT_COST;
 const n=Math.min(2, options.length);
 for(let k=0;k<n;k++){
  const ix=Math.floor(Math.random()*options.length);
  const p=options.splice(ix,1)[0];
  const have=new Set((revealed[p.w]||[]).map(Number));
  have.add(Number(p.i));
  revealed[p.w]=[...have];
 }
 revealMode=false;
 persistLevel(); updateCoins();
 playEffect('success');
 say(`${n} letter${n>1?'s':''} revealed · −${DOUBLE_HINT_COST} coins`);
 autoCompleteRevealedWords();
 renderCrossword();
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
function openLevelGrid(stageIndex){const first=stageIndex*25,last=Math.min(first+24,levels.length-1);const buttons=[];for(let i=first;i<=last;i++){const open=i<=state.unlockedLevel;const done=(state.solvedByLevel[i]||[]).length>=(levels[i]?.words.length||99);buttons.push(`<button class="lvl-btn ${i===state.currentLevel?'is-current':''} ${done?'is-done':''}" data-lvl="${i}" ${open?'':'disabled'}>${i+1}</button>`)}showModal('Pick a level',`<div class="lvl-grid">${buttons.join('')}</div><button class="action" id="backStages">← Stages</button>`);$('backStages').onclick=openLevels;$('modal').querySelectorAll('[data-lvl]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.lvl);$('overlay').classList.remove('show','finish-open');startGame(i)})}
function openLevels(){const cards=[];const count=Math.ceil(levels.length/25);for(let i=0;i<count;i++){const base=STAGES[i%STAGES.length],cycle=Math.floor(i/STAGES.length),name=cycle?`${base[0]} ${cycle+1}`:base[0],first=i*25,last=Math.min(first+24,levels.length-1),open=first<=state.unlockedLevel;cards.push(`<button class="stage-card" data-stage-index="${i}" ${open?'':'disabled'}><strong>${esc(name)}</strong><span>Levels ${first+1}–${last+1} · ${open?'Unlocked':'Locked'}</span></button>`)}showModal('Choose a stage',`<div class="stage-grid">${cards.join('')}</div>`);$('modal').querySelectorAll('[data-stage-index]').forEach(b=>b.onclick=()=>openLevelGrid(Number(b.dataset.stageIndex)))}
function openGameMenu(){
 showModal('Game menu',
  `<div class="menu-options">
    <button class="action" id="settingsOpen">♫ Sound</button>
    <button class="action" id="shopOpen">◉ Shop</button>
    <button class="action" id="dailyOpen">☀ Daily puzzle</button>
    <button class="action" id="miniOpen">▣ Grove Breaker</button>
    <button class="action" id="cheatOpen">✧ Cheat codes</button>
    <button class="action" id="shareOpen">↗ Challenge a friend</button>
    <button class="action" id="levelsOpen">✧ Levels</button>
    <button class="action" id="returnHome">⌂ Return to menu</button>
  </div>`);
 const m=$('modal');
 m.querySelector('#settingsOpen').onclick=openSoundSettings;
 m.querySelector('#shopOpen').onclick=openShop;
 m.querySelector('#dailyOpen').onclick=startDaily;
 m.querySelector('#miniOpen').onclick=openBreaker;
 m.querySelector('#cheatOpen').onclick=openCheats;
 m.querySelector('#shareOpen').onclick=shareChallenge;
 m.querySelector('#levelsOpen').onclick=openLevels;
 m.querySelector('#returnHome').onclick=showHome;
}
function openSoundSettings(){showModal('Sound settings',`<div class="menu-options"><button class="action" id="quietToggle">Quiet mode: ${quiet?'On':'Off'}</button><button class="action" id="musicToggle">Background music: ${musicOn?'On':'Off'}</button><button class="action" id="effectsToggle">Nature sounds: ${effectsOn?'On':'Off'}</button></div>`);$('modal').querySelector('#quietToggle').onclick=()=>{toggleQuiet();openSoundSettings()};$('modal').querySelector('#musicToggle').onclick=()=>{if(quiet)return;toggleMusic();openSoundSettings()};$('modal').querySelector('#effectsToggle').onclick=()=>{if(quiet)return;toggleEffects();openSoundSettings()}}
function toggleQuiet(){quiet=!quiet;state.quiet=quiet;if(quiet){musicOn=false;effectsOn=false;stopMusicForBackground()}saveState();say(quiet?'Quiet mode on':'Quiet mode off')}

// Original, gentle synthesized ambience and tiny nature-inspired interaction sounds.
function audio(){if(!audioCtx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;audioCtx=new C()}if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}
function playEffect(kind='button'){if(!effectsOn||quiet)return;const c=audio();if(!c)return;const now=c.currentTime;const osc=c.createOscillator(),gain=c.createGain();osc.type='sine';const stageTone={'meadow':0,'field':-90,'moonlit-forest':-180,'waterfall':140,'autumn-grove':-40,'crystal-lake':90,'misty-highlands':-120,'sunset-valley':60}[document.body.dataset.stage]||0;const f=(kind==='success'?1250:kind==='letter'?1450:kind==='button'?820:560)+stageTone;osc.frequency.setValueAtTime(f,now);osc.frequency.exponentialRampToValueAtTime(kind==='button'?f*.48:f*1.65,now+(kind==='button'?.18:.11));gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='success'?.035:.025,now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+(kind==='button'?.22:.17));osc.connect(gain).connect(c.destination);osc.start(now);osc.stop(now+(kind==='button'?.23:.18));if(kind==='success'){for(let j=0;j<2;j++){const o=c.createOscillator(),g=c.createGain(),t=now+.06+j*.14;o.type='sine';o.frequency.setValueAtTime(1500-j*180,t);o.frequency.exponentialRampToValueAtTime(2100-j*180,t+.09);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.018,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.18);o.connect(g).connect(c.destination);o.start(t);o.stop(t+.19)}}}
let musicChord=0;function musicNote(){const c=audio();if(!c)return;const now=c.currentTime;const themes={'meadow':[[196,246.94,293.66,369.99],[164.81,196,246.94,329.63],[174.61,220,261.63,349.23]],'field':[[174.61,220,261.63,329.63],[146.83,196,246.94,293.66],[164.81,207.65,246.94,329.63]],'moonlit-forest':[[146.83,174.61,220,261.63],[130.81,164.81,196,246.94],[146.83,185,220,277.18]],'waterfall':[[220,261.63,329.63,392],[196,246.94,293.66,369.99],[174.61,220,293.66,349.23]],'autumn-grove':[[164.81,207.65,246.94,311.13],[146.83,185,220,277.18],[155.56,196,233.08,293.66]],'crystal-lake':[[207.65,261.63,311.13,415.3],[185,233.08,277.18,369.99],[196,246.94,293.66,392]],'misty-highlands':[[174.61,207.65,261.63,311.13],[155.56,196,233.08,311.13],[164.81,220,261.63,329.63]],'sunset-valley':[[185,233.08,277.18,349.23],[164.81,207.65,246.94,329.63],[174.61,220,261.63,349.23]]};const progression=themes[document.body.dataset.stage]||themes.meadow;const notes=progression[musicChord++%progression.length];for(let i=0;i<notes.length;i++){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=notes[i];g.gain.setValueAtTime(.0001,now);g.gain.linearRampToValueAtTime(.009,now+1.4);g.gain.linearRampToValueAtTime(.0001,now+5.8);o.connect(g).connect(c.destination);o.start(now+i*.2);o.stop(now+5.9)}}
function stopMusicForBackground(){clearInterval(musicTimer);musicTimer=null;if(audioCtx&&audioCtx.state==='running')audioCtx.suspend().catch(()=>{})}
function resumeMusic(){if(!musicOn||quiet||document.hidden)return;const c=audio();if(c&&c.state==='suspended')c.resume().catch(()=>{});if(!musicTimer){musicNote();musicTimer=setInterval(musicNote,5700)}}
function toggleMusic(){musicOn=!musicOn;if(musicOn){audio();musicNote();clearInterval(musicTimer);musicTimer=setInterval(musicNote,5700)}else{stopMusicForBackground()}}
function toggleEffects(){effectsOn=!effectsOn}

function buzz(pat){try{if(quiet)return;if(navigator.vibrate)navigator.vibrate(pat||12)}catch(e){}}
function resetCombo(){combo=0;comboAt=0}
function comboBonus(){const now=Date.now();if(now-comboAt<8000)combo++;else combo=1;comboAt=now;if(combo<2)return 0;return (combo-1)*2}
function burst(n){const layer=$('fx');if(!layer)return;const count=Math.min(18,6+(n||1)*3);for(let i=0;i<count;i++){const s=document.createElement('i');s.className='spark';s.style.left=(30+Math.random()*40)+'%';s.style.top='38%';s.style.setProperty('--dx',(Math.random()*180-90)+'px');s.style.setProperty('--dy',(-40-Math.random()*120)+'px');layer.append(s);setTimeout(()=>s.remove(),800)}}
function coachWords(){const found=[];const have=new Set(levels[level].words);for(const w of dictionary){if(w.length<4||w.length>rack.length||have.has(w)||extras.has(w))continue;if(!bonusAllowed(w,''))continue;if(canMakeFromRack(w))found.push(w);if(found.length>=12)break}found.sort((a,b)=>b.length-a.length);return found.slice(0,2)}
function openShop(){showModal('Shop',`<div class="menu-options"><button class="action" id="buyWord">Reveal selected word · ${WORD_REVEAL_COST} coins</button><button class="action" id="buyLetters">Reveal two letters · ${DOUBLE_HINT_COST} coins</button><p class="finish-detail">Hints cost more now. Puzzle words pay ${WORD_REWARD} coins, combos add extra, a level pays ${LEVEL_REWARD}.</p></div>`);$('buyWord').onclick=()=>{$('overlay').classList.remove('show');buyRevealWord()};$('buyLetters').onclick=()=>{$('overlay').classList.remove('show');revealTwo()}}
function buyRevealWord(){if(!selectedWord){say('Select a crossword word first');return}if(solved.has(selectedWord)){say('That word is already solved');return}if(state.coins<WORD_REVEAL_COST){say(`You need ${WORD_REVEAL_COST} coins`);return}state.coins-=WORD_REVEAL_COST;revealed[selectedWord]=Array.from({length:selectedWord.length},(_,i)=>i);persistLevel();updateCoins();playEffect('success');say('Word revealed');autoCompleteRevealedWords();renderCrossword()}
function openCheats(){showModal('Cheat codes',`<input id="cheatCode" placeholder="Password" autocomplete="off"><button class="action primary" id="cheatGo">Enter</button><p class="finish-detail">Try a password. Codes are not case sensitive.</p>`);$('cheatGo').onclick=()=>{const code=($('cheatCode').value||'').trim().toUpperCase();if(code==='GROVE100'){state.coins+=100;saveState();updateCoins();say('+100 coins')}else if(code==='MEADOW'){state.unlockedLevel=Math.min(levels.length-1,(state.unlockedLevel||0)+25);saveState();updateHome();say('Next stage unlocked')}else if(code==='LEAF'){if(!selectedWord){say('Select a word first');return}revealed[selectedWord]=Array.from({length:selectedWord.length},(_,i)=>i);autoCompleteRevealedWords();renderCrossword();say('Leaf reveal')}else say('Unknown code');$('overlay').classList.remove('show')}}
function todayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function dailyIndex(){const k=todayKey().replace(/-/g,'');let h=0;for(const ch of k)h=(h*33+ch.charCodeAt(0))>>>0;return levels.length? h%levels.length : 0}
function startDaily(){if(!levels.length)return;const key=todayKey();if(state.dailyDone===key){say('Daily already finished · streak '+ (state.dailyStreak||0));return}$('overlay').classList.remove('show','finish-open');mode='daily';level=dailyIndex();document.body.classList.add('in-game');$('homeScreen').hidden=true;$('gameScreen').hidden=false;solved=new Set();revealed={};extras=new Set();selectedWord=null;completionShown=false;renderGame();say('Daily puzzle · streak '+(state.dailyStreak||0))}
function shareChallenge(){const n=(mode==='campaign'?state.currentLevel:level)+1;const url=location.origin+location.pathname+'?level='+n;const text='Play Wordgrove level '+n+' with me: '+url;if(navigator.share)navigator.share({title:'Wordgrove',text,url}).catch(()=>{});else{navigator.clipboard?.writeText(url);say('Challenge link copied')}}
function ensureAmbient(){if($('ambient'))return;const d=document.createElement('div');d.id='ambient';d.setAttribute('aria-hidden','true');for(let i=0;i<14;i++){const s=document.createElement('span');s.style.left=Math.random()*100+'%';s.style.animationDuration=(7+Math.random()*9)+'s';s.style.animationDelay=(-Math.random()*9)+'s';d.append(s)}document.body.append(d);const fx=document.createElement('div');fx.id='fx';fx.setAttribute('aria-hidden','true');document.body.append(fx)}
function renderWotd(){const el=$('wotd');if(!el)return;const bank=['grove','meadow','leaf','river','amber','moss','trail','cedar'];const key=todayKey();let h=0;for(const ch of key)h=(h*31+ch.charCodeAt(0))>>>0;const word=bank[h%bank.length];const local=definitions[word];el.textContent='Word of the day: '+word+' — '+(Array.isArray(local)?local[0]:local||'A small piece of the grove to carry with you.');}
function openBreaker(){$('overlay').classList.remove('show');const old=$('breaker');if(old)old.remove();const wrap=document.createElement('div');wrap.id='breaker';wrap.className='breaker';wrap.innerHTML='<canvas id="brk" width="320" height="420"></canvas><button class="action" id="brkClose">Close</button>';document.body.append(wrap);$('brkClose').onclick=()=>wrap.remove();const cv=$('brk'),ctx=cv.getContext('2d');let x=160,y=390,dx=2.2,dy=-2.6,px=130,lives=3,score=0,bricks=[];for(let r=0;r<4;r++)for(let c=0;c<7;c++)bricks.push({x:12+c*44,y:20+r*22,w:40,h:16,on:true});let alive=true;function step(){if(!alive||!wrap.isConnected)return;ctx.fillStyle='#102b27';ctx.fillRect(0,0,320,420);ctx.fillStyle='#f3c66a';bricks.forEach(b=>{if(!b.on)return;if(x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h){dy=-dy;b.on=false;score+=10}ctx.fillRect(b.x,b.y,b.w,b.h)});ctx.fillStyle='#fff7e6';ctx.fillRect(px,400,60,8);ctx.beginPath();ctx.arc(x,y,6,0,7);ctx.fill();x+=dx;y+=dy;if(x<6||x>314)dx=-dx;if(y<6)dy=-dy;if(y>408){lives--;y=300;dy=-Math.abs(dy);if(lives<=0){alive=false;ctx.fillStyle='#fff';ctx.font='16px sans-serif';ctx.fillText('Score '+score,110,220);if(score>=80){state.coins+=15;saveState();updateCoins()}return}}if(x>px&&x<px+60&&y>394&&y<408)dy=-Math.abs(dy);if(bricks.every(b=>!b.on)){alive=false;state.coins+=25;saveState();updateCoins();say('+25 coins');return}requestAnimationFrame(step)}cv.ontouchmove=cv.onmousemove=(e)=>{const r=cv.getBoundingClientRect();const cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left;px=Math.max(0,Math.min(260,cx/r.width*320-30))};requestAnimationFrame(step)}

$('playBtn').addEventListener('click',()=>startGame());$('homeMenuBtn').addEventListener('click',openGameMenu);$('gameMenuBtn').addEventListener('click',openGameMenu);$('levelsBtn').addEventListener('click',openLevels);$('shuffle').addEventListener('click',shuffle);$('hint').addEventListener('click',openHints);$('wordListBtn').addEventListener('click',openWordList);$('extrasBtn').addEventListener('click',openExtras);if($('allWordsBtn'))$('allWordsBtn').addEventListener('click',openAllWords);if($('dailyBtn'))$('dailyBtn').addEventListener('click',startDaily);if($('miniBtn'))$('miniBtn').addEventListener('click',openBreaker);$('homeHelp').addEventListener('click',()=>showModal('How to play','Swipe letters on the wheel. Tap a crossword word to select it. Solve every crossword word to finish. Bonus words must be real words, not names, places, or abbreviations. Quiet mode is in Sound.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMusicForBackground();else resumeMusic()});window.addEventListener('pagehide',stopMusicForBackground);window.addEventListener('pageshow',()=>{if(!document.hidden)resumeMusic()});
document.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('.letter'))playEffect('button')});
$('wheel').addEventListener('pointerdown',handleDown);document.addEventListener('pointermove',handleMove,{passive:false});document.addEventListener('pointerup',handleUp);document.addEventListener('pointercancel',handleUp);
async function boot(){try{const [lr,dr,df]=await Promise.all([fetch('./levels.json'),fetch('./dictionary.json'),fetch('./definitions.json').catch(()=>null)]);if(!lr.ok||!dr.ok)throw Error('Puzzle files unavailable');levels=await lr.json();dictionary=new Set(await dr.json());if(df?.ok)definitions=await df.json();try{definitions={...definitions,...JSON.parse(localStorage.getItem('wordgrove-definitions')||'{}')}}catch{}repairProgress();quiet=!!state.quiet;if(quiet){musicOn=false;effectsOn=false}ensureAmbient();updateHome();showHome();renderWotd();const params=new URLSearchParams(location.search);const lv=params.get('level');if(lv){const idx=Math.min(levels.length-1,Math.max(0,(+lv||1)-1));if(idx<=state.unlockedLevel)startGame(idx)}const hv=$('homeVersion');if(hv)hv.textContent=`Wordgrove v${APP_VERSION}`;if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}catch(e){$('homeScreen').innerHTML='<div class="hero"><h1>Wordgrove</h1><p>The puzzle library could not be loaded. Connect to the internet once, then refresh.</p></div>'}}
window.addEventListener('resize',()=>{if(levels.length&&!$('gameScreen').hidden){renderCrossword();drawWheel()}});boot();
