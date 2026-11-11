const APP_VERSION = '3.5.13';
const $ = id => document.getElementById(id);
const SAVE_KEY = 'wordgrove-v4-save';
const LETTER_HINT_COST = 25, DEFINITION_HINT_COST = 15, DOUBLE_HINT_COST = 40;
const WORD_REWARD = 5, LEVEL_REWARD = 20;
const TWO_LETTER_WORDS = new Set('am an as at be by do go he if in is it me my no of oh on or ox so to up us we'.split(' '));
const REJECTED_BONUS_WORDS = new Set([
  // acronyms / initialisms / abbreviations
  'eal','lae','fbi','tra','la','doc','mfg','str','avg','etc','inc','ltd','mrs','mr','ms','dr','st','rd','ave','dept','gov','govt','corp','llc','vs','etc','aka','diy','asap','rsvp','tba','tbd','faq','gps','usb','pdf','html','css','js','api','url','http','https','www','usa','uk','eu','un','nato','nasa','cia','nsa','irs','dna','rna','hiv','aids','covid','pc','tv','dvd','cd','hd','sd','ui','ux','ceo','cfo','cto','hr','pr','qa','id','iq','eq','ok','lol','omg','btw','imo','fyi','brb','ttyl','afaik','irl','dm','pm','am','bc','ad','ph','d','b','c','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
  // given examples + similar
  'lare','roat','stor','stra','cali','peru','shiv','doc',
  // common place-name short forms / places that appear as short words
  'nyc','la','sf','dc','uk','usa','eu','asia','rome','paris','tokyo','oslo','bern','lima','quito','cairo','delhi','miami','dallas','boston','seattle','denver','austin','phoenix','atlanta','chicago','houston','london','berlin','madrid','moscow','sydney','dublin','ottawa','beijing','seoul','hanoi','manila','jakarta','bangkok','dubai','riyadh','tehran','baghdad','nairobi','lagos','accra','havana','quito','bogota','santiago','buenos','aires',
  // surnames / proper-name-ish that often slip in
  'smith','jones','brown','davis','miller','wilson','moore','taylor','anderson','thomas','jackson','white','harris','martin','garcia','clark','lewis','lee','walker','hall','allen','young','king','wright','scott','green','baker','adams','nelson','hill','ramirez','campbell','mitchell','roberts','carter','phillips','evans','turner','torres','parker','collins','edwards','stewart','flores','morris','nguyen','murphy','rivera','cook','rogers','morgan','peterson','cooper','reed','bailey','bell','gomez','kelly','howard','ward','cox','diaz','richardson','wood','watson','brooks','bennett','gray','james','reyes','cruz','hughes','price','myers','long','foster','sanders','ross','morales','powell','sullivan','russell','ortiz','jenkins','gutierrez','perry','butler','barnes','fisher',
  // slang / informal that should not earn bonus coins in this game
  'shiv','yeet','sus','cap','bet','bruh','fam','lit','slay','rizz','bussin','mid','stan','simp','based','cringe','noob','pwn','lmao','rofl','thicc','smol','chonky','boomer','zoomer','millenial','genx','genz','boomer','sus','cap'
].map(w=>w.toLowerCase()));

function looksLikeAcronymOrInitialism(word){
  const w=String(word).toLowerCase();
  if(w.length<2||w.length>5) return false;
  // all consonants (or mostly) short tokens often are initialisms: fbi, tra, mfg, str
  const vowels=w.replace(/[^aeiouy]/g,'');
  if(w.length>=3 && vowels.length===0) return true;
  if(w.length===2 && vowels.length===0) return true;
  // repeated letter pairs like aa, bb rarely real bonus words in this context
  if(/^(.)\1$/.test(w)) return true;
  return false;
}

function isRejectedBonusWord(word){
  const w=String(word).toLowerCase().trim();
  if(!w) return true;
  if(REJECTED_BONUS_WORDS.has(w)) return true;
  if(looksLikeAcronymOrInitialism(w)) return true;
  // Single-letter or pure digit noise
  if(/^[0-9]+$/.test(w)) return true;
  // Hyphenated / dotted abbreviations
  if(/[.\-]/.test(w)) return true;
  return false;
}

let levels=[], dictionary=new Set(), definitions={}, level=0, rack=[], picked=[], solved=new Set(), revealed={}, extras=new Set(), selectedWord=null;
let toastTimer, pointerActive=false, pointerId=null, dragged=false, startPoint=null, audioCtx=null, musicTimer=null, musicOn=true, effectsOn=true, revealMode=false, audioWasPlaying=false, completionShown=false, wheelObserver=null, boardObserver=null;
(function loadAudioPrefs(){
 try{
  const raw=localStorage.getItem('wordgrove-audio');
  if(raw){
   const p=JSON.parse(raw);
   if(typeof p.musicOn==='boolean') musicOn=p.musicOn;
   if(typeof p.effectsOn==='boolean') effectsOn=p.effectsOn;
  }
 }catch{}
})();
function saveAudioPrefs(){try{localStorage.setItem('wordgrove-audio',JSON.stringify({musicOn,effectsOn}))}catch{}}

const freshState=()=>({currentLevel:0,unlockedLevel:0,coins:50,solvedByLevel:{},revealedByLevel:{},extrasByLevel:{}});
let state=loadState();
function loadState(){try{const p=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return p?{...freshState(),...p,coins:Math.max(0,+p.coins||0)}:freshState()}catch{return freshState()}}
function saveState(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch{}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function say(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1700)}
function currentWord(){return picked.map(i=>rack[i]).join('')}
function levelNo(){return Math.min(Math.max(state.currentLevel,state.unlockedLevel),levels.length-1)+1}
function updateCoins(){$('homeCoins').textContent=state.coins;$('gameCoins').textContent=state.coins}
function updateHome(){$('homeLevel').textContent=levelNo().toLocaleString();updateCoins();$('homeWords').textContent=Object.values(state.solvedByLevel).reduce((n,a)=>n+(a||[]).length,0).toLocaleString();const hv=$('homeVersion');if(hv)hv.textContent=`Wordgrove v${APP_VERSION}`;}
function showHome(){document.body.classList.remove('in-game');$('gameScreen').hidden=true;$('homeScreen').hidden=false;$('overlay').classList.remove('show');updateHome()}
function clampLevel(n){return Math.max(0,Math.min(Number(n)||0,levels.length-1))}
function isLevelComplete(n){const words=levels[n]?.words||[];const solvedArr=state.solvedByLevel[n]||[];return words.length>0&&solvedArr.length>=words.length}
/** Jump to an explicit level index. Respects unlock unless force=true (dev). */
function goToLevel(n,{force=false,resumeNextIncomplete=false}={}){
 n=clampLevel(n);
 if(!force && n>state.unlockedLevel){ say('That level is still locked'); return false; }
 // Optional: from Play button, hop past fully-solved levels to the first incomplete unlocked one
 if(resumeNextIncomplete){
  let candidate=n;
  while(candidate<state.unlockedLevel && isLevelComplete(candidate)) candidate++;
  n=clampLevel(Math.min(candidate,state.unlockedLevel));
 }
 level=n;
 state.currentLevel=n;
 // Ensure unlock tracks progress if we somehow completed current
 if(isLevelComplete(n)) state.unlockedLevel=Math.max(state.unlockedLevel,Math.min(n+1,levels.length-1));
 document.body.classList.add('in-game');
 $('homeScreen').hidden=true;
 $('gameScreen').hidden=false;
 $('overlay').classList.remove('show');
 renderGame();
 saveState();
 return true;
}
function startGame(){
 // Play / Continue: resume working level, skipping already-finished ones only when appropriate
 const resume=clampLevel(state.currentLevel);
 goToLevel(resume,{resumeNextIncomplete:true});
}
function persistLevel(){state.solvedByLevel[level]=[...solved];state.revealedByLevel[level]=revealed;state.extrasByLevel[level]=[...extras];state.currentLevel=level;saveState()}
function renderGame(){
 const data=levels[level]; if(!data)return;
 completionShown=false; revealMode=false; rack=data.letters.slice(); picked=[]; solved=new Set(state.solvedByLevel[level]||[]); revealed=state.revealedByLevel[level]||{}; extras=new Set(state.extrasByLevel[level]||[]); selectedWord=null;
 const stage=stageForLevel(level);
 $('levelname').textContent=`${stage.name} · ${level+1}`;
 document.body.dataset.stage=stage.key;
 document.body.className=`stage-${stage.key} in-game`;
 if(typeof restartMusicForStage==='function') restartMusicForStage();
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
 const size=Math.min(rect.width, rect.height);
 // Radius leaves a margin so larger tiles never overlap; scale by letter count
 const tileScale = n<=5 ? 0.30 : n<=6 ? 0.27 : n<=7 ? 0.24 : n<=8 ? 0.22 : 0.20;
 const tilePx = Math.max(36, Math.min(64, size * tileScale));
 const gapFactor = n<=5 ? 0.42 : n<=6 ? 0.40 : n<=7 ? 0.38 : n<=8 ? 0.36 : 0.34;
 const radius = size * gapFactor;
 for(let i=0;i<n;i++){
  const b=document.createElement('button');
  b.type='button';
  b.className='letter' + (picked.includes(i) ? ' selected' : '');
  b.textContent=rack[i].toUpperCase();
  const angle=-Math.PI/2 + i*2*Math.PI/n;
  b.style.left=`${50 + Math.cos(angle)*radius/rect.width*100}%`;
  b.style.top=`${50 + Math.sin(angle)*radius/rect.height*100}%`;
  b.style.width=`${tilePx}px`;
  b.style.height=`${tilePx}px`;
  b.style.fontSize=`${Math.round(tilePx*0.42)}px`;
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
function coinRewardForExtra(word){const len=String(word).length;return len<=3?0:len-3}
function canMakeFromRack(word){const available={};for(const c of rack)available[c]=(available[c]||0)+1;for(const c of word){if(!available[c])return false;available[c]--}return true}
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
   if(Array.isArray(data)&&data.length&&data[0].meanings){ remember(); return true; }
  }
 }catch(e){}
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6000);
  const r=await fetch('https://api.datamuse.com/words?sp='+encodeURIComponent(key)+'&md=d&max=1',{signal:controller.signal});
  clearTimeout(timer);
  if(r.ok){
   const data=await r.json();
   if(Array.isArray(data)&&data[0]&&data[0].word===key&&Array.isArray(data[0].defs)&&data[0].defs.length){ remember(); return true; }
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
  let okBonus = (w.length===2 && TWO_LETTER_WORDS.has(w)) || (w.length>=3 && dictionary.has(w));
  // If missing locally, try online dictionary (covers gaps like "tan")
  if(!okBonus && w.length>=3){
   say('Checking word…');
   okBonus = await lookupEnglishWord(w);
  }
  if(okBonus){
   if(isRejectedBonusWord(w)){
    say('Not accepted as a bonus word (abbreviation, place name, or slang)');
    return;
   }
   if(extras.has(w)){ say('Already in your extra words list'); return; }
   extras.add(w);
   const reward=coinRewardForExtra(w);
   state.coins+=reward;
   persistLevel(); updateCoins();
   if(reward>0) say(`Extra word! +${reward} coin${reward===1?'':'s'}`);
   else say('Extra word recorded');
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
 if(reward) state.coins+=WORD_REWARD;
 persistLevel(); updateCoins();
 playEffect('success');
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
  if(!completionShown) say(`+${WORD_REWARD} coins · Well done!`);
 }
}
function finishLevel(){if(completionShown||solved.size<levels[level].words.length)return;completionShown=true;const final=level===levels.length-1;const wordCoins=solved.size*WORD_REWARD;const bonusCoins=[...extras].reduce((n,w)=>n+coinRewardForExtra(w),0);state.coins+=LEVEL_REWARD;state.unlockedLevel=Math.max(state.unlockedLevel,Math.min(level+1,levels.length-1));persistLevel();updateCoins();const points=wordCoins+LEVEL_REWARD+bonusCoins;$('modal').innerHTML=`<div class="level-finish"><div class="finish-leaf">✦</div><h2>${final?'All levels complete!':'Level complete!'}</h2><p>Beautifully done. The next part of your adventure awaits.</p><div class="stats"><div><strong>+${points}</strong><span>POINTS GAINED</span></div><div><strong>${extras.size}</strong><span>BONUS WORDS</span></div></div><p class="finish-detail">${wordCoins} word points · ${LEVEL_REWARD} level bonus${bonusCoins?` · ${bonusCoins} bonus-word coins`:''}</p><button class="action primary" id="next">${final?'Return to menu':`Continue to ${stageForLevel(level+1).name} · ${level+2} →`}</button></div>`;$('overlay').classList.add('show');$('next').onclick=()=>{$('overlay').classList.remove('show');if(final){showHome();return}state.currentLevel=Math.min(level+1,levels.length-1);saveState();level=state.currentLevel;renderGame()}}
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

function openWordList(){const words=[...new Set(Object.values(state.solvedByLevel).flatMap(a=>a||[]))].sort();showListModal('Words found',words,'All puzzle words you have solved across your adventure.');}
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
function stageForLevel(n){
 const stageIndex=Math.floor(n/25);
 const base=STAGES[stageIndex%STAGES.length];
 const cycle=Math.floor(stageIndex/STAGES.length);
 const name=cycle?`${base[0]} ${cycle+1}`:base[0];
 return {name,key:base[1],first:stageIndex*25,last:Math.min(stageIndex*25+24,levels.length-1)};
}
function openLevels(){
 const cards=[];
 const count=Math.ceil(levels.length/25);
 for(let i=0;i<count;i++){
  const base=STAGES[i%STAGES.length], cycle=Math.floor(i/STAGES.length);
  const name=cycle?`${base[0]} ${cycle+1}`:base[0];
  const first=i*25, last=Math.min(first+24,levels.length-1);
  const open=first<=state.unlockedLevel;
  let done=0;
  for(let L=first;L<=last;L++) if(isLevelComplete(L)) done++;
  const total=last-first+1;
  cards.push(`<button class="stage-card" data-stage-index="${i}" ${open?'':'disabled'}><strong>${esc(name)}</strong><span>Levels ${first+1}–${last+1} · ${done}/${total} clear · ${open?'Unlocked':'Locked'}</span></button>`);
 }
 showModal('Choose a stage',`<div class="stage-grid">${cards.join('')}</div>`);
 $('modal').querySelectorAll('[data-stage-index]').forEach(b=>{
  b.onclick=()=>openStageLevels(Number(b.dataset.stageIndex));
 });
}
function openStageLevels(stageIndex){
 const first=stageIndex*25;
 const last=Math.min(first+24,levels.length-1);
 const base=STAGES[stageIndex%STAGES.length];
 const cycle=Math.floor(stageIndex/STAGES.length);
 const name=cycle?`${base[0]} ${cycle+1}`:base[0];
 const rows=[];
 for(let L=first;L<=last;L++){
  const locked=L>state.unlockedLevel;
  const done=isLevelComplete(L);
  const current=L===state.currentLevel;
  const words=levels[L]?.words?.length||0;
  const found=(state.solvedByLevel[L]||[]).length;
  let badge='';
  if(locked) badge='Locked';
  else if(done) badge='Cleared';
  else if(found>0) badge=`${found}/${words}`;
  else badge='Open';
  const cls=['level-row'];
  if(locked) cls.push('locked');
  if(done) cls.push('done');
  if(current) cls.push('current');
  rows.push(`<button class="${cls.join(' ')}" data-level="${L}" ${locked?'disabled':''}><span class="level-row-num">#${L+1}</span><span class="level-row-meta">${words} words · ${badge}</span>${current?'<span class="level-row-tag">Current</span>':''}</button>`);
 }
 showModal(name,`<p class="stage-summary">Levels ${first+1}–${last+1}. Tap any unlocked level to play it — progress on other levels is kept.</p><div class="level-list">${rows.join('')}</div><button class="action" id="backToStages">← All stages</button>`);
 const m=$('modal');
 m.querySelectorAll('[data-level]').forEach(b=>{
  b.onclick=()=>{
   const n=Number(b.dataset.level);
   goToLevel(n,{force:false,resumeNextIncomplete:false});
  };
 });
 const back=m.querySelector('#backToStages');
 if(back) back.onclick=()=>openLevels();
}
function isDevMode(){
 try{
  if(new URLSearchParams(location.search).get('dev')==='1') return true;
  if(localStorage.getItem('wordgrove-dev')==='1') return true;
 }catch{}
 return false;
}
function openGameMenu(){
 const dev=isDevMode();
 showModal('Game menu',
  `<div class="menu-options">
    <button class="action" id="settingsOpen">♫ Sound settings</button>
    <button class="action" id="levelsOpen">✧ Levels</button>
    <button class="action" id="returnHome">⌂ Return to menu</button>
    ${dev?`<button class="action" id="devToolsOpen">⚒ Testing tools</button>`:''}
  </div>`);
 const m=$('modal');
 m.querySelector('#settingsOpen').onclick=openSoundSettings;
 m.querySelector('#levelsOpen').onclick=openLevels;
 m.querySelector('#returnHome').onclick=showHome;
 const d=m.querySelector('#devToolsOpen');
 if(d) d.onclick=openDevTools;
}
function openDevTools(){
 showModal('Testing tools',
  `<p class="stage-summary">Developer helpers. Progress is saved to this browser only.</p>
   <div class="menu-options">
    <button class="action" id="devAutoSolve">Auto-solve current level</button>
    <button class="action" id="devUnlock20">Unlock first 20 levels (mark cleared)</button>
    <button class="action" id="devUnlock50">Unlock first 50 levels</button>
    <button class="action" id="devUnlockAll">Unlock all levels</button>
    <button class="action" id="devAddCoins">+500 coins</button>
    <button class="action" id="devJump">Jump to level…</button>
    <button class="action" id="devResetLevel">Reset current level progress</button>
    <button class="action" id="devResetAll">Reset ALL progress</button>
    <button class="action" id="devDisable">Hide testing tools</button>
   </div>
   <button class="action" id="devBack">← Back</button>`);
 const m=$('modal');
 m.querySelector('#devBack').onclick=openGameMenu;
 m.querySelector('#devAutoSolve').onclick=()=>{devAutoSolve();};
 m.querySelector('#devUnlock20').onclick=()=>{devUnlockThrough(19); openDevTools();};
 m.querySelector('#devUnlock50').onclick=()=>{devUnlockThrough(49); openDevTools();};
 m.querySelector('#devUnlockAll').onclick=()=>{devUnlockThrough(levels.length-1); openDevTools();};
 m.querySelector('#devAddCoins').onclick=()=>{state.coins+=500; saveState(); updateCoins(); say('+500 coins');};
 m.querySelector('#devJump').onclick=()=>{
  const raw=prompt('Jump to level number (1–'+levels.length+')', String(level+1));
  if(raw==null) return;
  const n=parseInt(raw,10);
  if(!Number.isFinite(n)||n<1||n>levels.length){ say('Invalid level'); return; }
  state.unlockedLevel=Math.max(state.unlockedLevel,n-1);
  goToLevel(n-1,{force:true});
 };
 m.querySelector('#devResetLevel').onclick=()=>{
  delete state.solvedByLevel[level];
  delete state.revealedByLevel[level];
  delete state.extrasByLevel[level];
  saveState();
  renderGame();
  say('Current level reset');
 };
 m.querySelector('#devResetAll').onclick=()=>{
  if(!confirm('Erase all Wordgrove progress on this device?')) return;
  state=freshState();
  saveState();
  showHome();
  say('Progress cleared');
 };
 m.querySelector('#devDisable').onclick=()=>{
  try{ localStorage.removeItem('wordgrove-dev'); }catch{}
  say('Testing tools hidden (add ?dev=1 to URL to show again)');
  openGameMenu();
 };
}
function devUnlockThrough(lastIndex){
 lastIndex=clampLevel(lastIndex);
 for(let i=0;i<=lastIndex;i++){
  const words=levels[i]?.words||[];
  state.solvedByLevel[i]=words.slice();
 }
 state.unlockedLevel=Math.max(state.unlockedLevel,Math.min(lastIndex+1,levels.length-1));
 state.currentLevel=Math.min(lastIndex,state.unlockedLevel);
 saveState();
 updateHome();
 say(`Unlocked through level ${lastIndex+1}`);
}
function devAutoSolve(){
 if($('gameScreen').hidden||!levels[level]){ say('Open a level first'); return; }
 const words=levels[level].words||[];
 for(const w of words){
  if(!solved.has(w)) solveWord(w,false);
 }
 say('Level auto-solved');
}
function openSoundSettings(){showModal('Sound settings',`<div class="menu-options"><button class="action" id="musicToggle">Music: ${musicOn?'On':'Off'}</button><button class="action" id="effectsToggle">Sounds: ${effectsOn?'On':'Off'}</button></div>`);$('modal').querySelector('#musicToggle').onclick=()=>{toggleMusic();openSoundSettings()};$('modal').querySelector('#effectsToggle').onclick=()=>{toggleEffects();openSoundSettings()}}

// Original, gentle synthesized ambience and tiny nature-inspired interaction sounds.
function audio(){if(!audioCtx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;audioCtx=new C()}if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}
function playEffect(kind='button'){
 if(!effectsOn) return;
 const c=audio(); if(!c) return;
 const now=c.currentTime;
 const stage=document.body.dataset.stage||'meadow';
 // Distinct timbre, pitch center, and envelope per stage
 const profiles={
  'meadow':         {type:'sine',     base:{success:1180,letter:1320,button:780,other:520}, detune:0,   bright:1.55, gain:0.028, attack:0.018, decay:0.17},
  'field':          {type:'triangle', base:{success:980, letter:1100,button:640,other:440}, detune:12,  bright:1.35, gain:0.030, attack:0.022, decay:0.20},
  'moonlit-forest': {type:'sine',     base:{success:720, letter:860, button:480,other:360}, detune:-8,  bright:1.25, gain:0.022, attack:0.035, decay:0.28},
  'waterfall':      {type:'sawtooth', base:{success:1400,letter:1550,button:900,other:600}, detune:18,  bright:1.70, gain:0.018, attack:0.012, decay:0.14},
  'autumn-grove':   {type:'triangle', base:{success:1050,letter:1200,button:700,other:480}, detune:-14, bright:1.40, gain:0.026, attack:0.025, decay:0.22},
  'crystal-lake':   {type:'sine',     base:{success:1560,letter:1720,button:980,other:640}, detune:6,   bright:1.85, gain:0.024, attack:0.015, decay:0.16},
  'misty-highlands':{type:'triangle', base:{success:820, letter:940, button:560,other:400}, detune:-20, bright:1.30, gain:0.025, attack:0.040, decay:0.30},
  'sunset-valley':  {type:'sine',     base:{success:1120,letter:1280,button:760,other:500}, detune:10,  bright:1.50, gain:0.027, attack:0.020, decay:0.19}
 };
 const p=profiles[stage]||profiles.meadow;
 const f0=(p.base[kind]||p.base.other)+p.detune;
 const osc=c.createOscillator(), gain=c.createGain();
 osc.type=p.type;
 osc.frequency.setValueAtTime(Math.max(80,f0), now);
 const endF=kind==='button'?Math.max(60,f0*0.48):Math.max(90,f0*p.bright);
 osc.frequency.exponentialRampToValueAtTime(endF, now+(kind==='button'?0.18:0.11));
 gain.gain.setValueAtTime(0.0001, now);
 gain.gain.exponentialRampToValueAtTime(kind==='success'?p.gain*1.25:p.gain, now+p.attack);
 gain.gain.exponentialRampToValueAtTime(0.0001, now+(kind==='button'?0.22:p.decay));
 // Soft low-pass so harsher waveforms stay pleasant
 const filter=c.createBiquadFilter();
 filter.type='lowpass';
 filter.frequency.value=stage==='waterfall'?3200:stage==='crystal-lake'?4200:2800;
 osc.connect(filter); filter.connect(gain); gain.connect(c.destination);
 osc.start(now); osc.stop(now+(kind==='button'?0.24:p.decay+0.04));
 if(kind==='success'){
  for(let j=0;j<2;j++){
   const o=c.createOscillator(), g=c.createGain(), t0=now+0.06+j*0.13;
   o.type=p.type;
   const ff=f0*(1.15-j*0.12);
   o.frequency.setValueAtTime(ff, t0);
   o.frequency.exponentialRampToValueAtTime(ff*1.25, t0+0.09);
   g.gain.setValueAtTime(0.0001, t0);
   g.gain.linearRampToValueAtTime(p.gain*0.7, t0+0.02);
   g.gain.exponentialRampToValueAtTime(0.0001, t0+0.18);
   o.connect(g).connect(c.destination);
   o.start(t0); o.stop(t0+0.2);
  }
 }
}
let musicChord=0;
const STAGE_MUSIC={
 // Unique chord progressions + waveform + tempo character per stage
 'meadow':{
  wave:'sine', interval:5600, gain:0.010, stagger:0.20,
  chords:[[196.00,246.94,293.66,369.99],[164.81,196.00,246.94,329.63],[174.61,220.00,261.63,349.23],[146.83,196.00,246.94,293.66]]
 },
 'field':{
  wave:'triangle', interval:5200, gain:0.011, stagger:0.16,
  chords:[[174.61,220.00,261.63,329.63],[146.83,196.00,246.94,293.66],[164.81,207.65,246.94,329.63],[130.81,174.61,220.00,261.63]]
 },
 'moonlit-forest':{
  wave:'sine', interval:6400, gain:0.008, stagger:0.28,
  chords:[[146.83,174.61,220.00,261.63],[130.81,164.81,196.00,246.94],[146.83,185.00,220.00,277.18],[110.00,146.83,174.61,220.00]]
 },
 'waterfall':{
  wave:'sawtooth', interval:4800, gain:0.006, stagger:0.12,
  chords:[[220.00,261.63,329.63,392.00],[196.00,246.94,293.66,369.99],[174.61,220.00,293.66,349.23],[246.94,311.13,369.99,440.00]]
 },
 'autumn-grove':{
  wave:'triangle', interval:5800, gain:0.010, stagger:0.22,
  chords:[[164.81,207.65,246.94,311.13],[146.83,185.00,220.00,277.18],[155.56,196.00,233.08,293.66],[123.47,164.81,207.65,246.94]]
 },
 'crystal-lake':{
  wave:'sine', interval:5000, gain:0.009, stagger:0.14,
  chords:[[207.65,261.63,311.13,415.30],[185.00,233.08,277.18,369.99],[196.00,246.94,293.66,392.00],[233.08,293.66,349.23,440.00]]
 },
 'misty-highlands':{
  wave:'triangle', interval:6600, gain:0.009, stagger:0.30,
  chords:[[174.61,207.65,261.63,311.13],[155.56,196.00,233.08,311.13],[164.81,220.00,261.63,329.63],[130.81,174.61,207.65,261.63]]
 },
 'sunset-valley':{
  wave:'sine', interval:5400, gain:0.010, stagger:0.18,
  chords:[[185.00,233.08,277.18,349.23],[164.81,207.65,246.94,329.63],[174.61,220.00,261.63,349.23],[146.83,185.00,233.08,293.66]]
 }
};
function musicNote(){
 const c=audio(); if(!c) return;
 const now=c.currentTime;
 const stage=document.body.dataset.stage||'meadow';
 const theme=STAGE_MUSIC[stage]||STAGE_MUSIC.meadow;
 const notes=theme.chords[musicChord++%theme.chords.length];
 for(let i=0;i<notes.length;i++){
  const o=c.createOscillator(), g=c.createGain();
  const filter=c.createBiquadFilter();
  filter.type='lowpass';
  filter.frequency.value=stage==='waterfall'?2400:stage==='crystal-lake'?3600:2200;
  o.type=theme.wave;
  o.frequency.value=notes[i];
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(theme.gain, now+1.2);
  g.gain.linearRampToValueAtTime(0.0001, now+5.4);
  o.connect(filter); filter.connect(g); g.connect(c.destination);
  o.start(now+i*theme.stagger);
  o.stop(now+5.6);
 }
}
function stopMusicForBackground(){
 clearInterval(musicTimer); musicTimer=null;
 if(audioCtx&&audioCtx.state==='running') audioCtx.suspend().catch(()=>{});
}
function resumeMusic(){
 if(!musicOn||document.hidden) return;
 const c=audio();
 if(c&&c.state==='suspended') c.resume().catch(()=>{});
 if(!musicTimer){
  musicNote();
  const stage=document.body.dataset.stage||'meadow';
  const interval=(STAGE_MUSIC[stage]||STAGE_MUSIC.meadow).interval;
  musicTimer=setInterval(musicNote, interval);
 }
}
function restartMusicForStage(){
 if(!musicOn) return;
 clearInterval(musicTimer); musicTimer=null;
 musicChord=0;
 resumeMusic();
}
function toggleMusic(){
 musicOn=!musicOn; saveAudioPrefs();
 if(musicOn){ audio(); restartMusicForStage(); }
 else stopMusicForBackground();
}
function toggleEffects(){ effectsOn=!effectsOn; saveAudioPrefs(); }

$('playBtn').addEventListener('click',startGame);$('homeMenuBtn').addEventListener('click',openGameMenu);$('gameMenuBtn').addEventListener('click',openGameMenu);$('levelsBtn').addEventListener('click',openLevels);$('shuffle').addEventListener('click',shuffle);$('hint').addEventListener('click',openHints);$('wordListBtn').addEventListener('click',openWordList);$('extrasBtn').addEventListener('click',openExtras);$('homeHelp').addEventListener('click',()=>showModal('How to play','Swipe across the letter wheel to spell words. Tap a crossword word to select it for definition hints or a letter reveal. Solve every crossword word to finish a level. Bonus words earn coins.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMusicForBackground();else resumeMusic()});window.addEventListener('pagehide',stopMusicForBackground);window.addEventListener('pageshow',()=>{if(!document.hidden)resumeMusic()});
document.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('.letter'))playEffect('button')});
$('wheel').addEventListener('pointerdown',handleDown);document.addEventListener('pointermove',handleMove,{passive:false});document.addEventListener('pointerup',handleUp);document.addEventListener('pointercancel',handleUp);
async function boot(){try{const [lr,dr,df]=await Promise.all([fetch('./levels.json'),fetch('./dictionary.json'),fetch('./definitions.json').catch(()=>null)]);if(!lr.ok||!dr.ok)throw Error('Puzzle files unavailable');levels=await lr.json();dictionary=new Set(await dr.json());if(df?.ok)definitions=await df.json();try{definitions={...definitions,...JSON.parse(localStorage.getItem('wordgrove-definitions')||'{}')}}catch{}state.currentLevel=Math.min(state.currentLevel,levels.length-1);state.unlockedLevel=Math.min(state.unlockedLevel,levels.length-1);updateHome();showHome();const hv=$('homeVersion');if(hv)hv.textContent=`Wordgrove v${APP_VERSION}`;
 try{ if(new URLSearchParams(location.search).get('dev')==='1') localStorage.setItem('wordgrove-dev','1'); }catch{}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}catch(e){$('homeScreen').innerHTML='<div class="hero"><h1>Wordgrove</h1><p>The puzzle library could not be loaded. Connect to the internet once, then refresh.</p></div>'}}
window.addEventListener('resize',()=>{if(levels.length&&!$('gameScreen').hidden){renderCrossword();drawWheel()}});boot();
