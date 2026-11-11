const APP_VERSION = '3.5.20';
const $ = id => document.getElementById(id);
const SAVE_KEY = 'wordgrove-v4-save';
const LETTER_HINT_COST = 25, DEFINITION_HINT_COST = 15, DOUBLE_HINT_COST = 40;
const WORD_REWARD = 5, LEVEL_REWARD = 20;
const TWO_LETTER_WORDS = new Set('am an as at be by do go he if in is it me my no of oh on or ox so to up us we'.split(' '));
const REJECTED_BONUS_WORDS = new Set([
  // User examples + close variants
  'eal','lae','fbi','tra','la','doc','lare','roat','stor','mfg','stra','cali','peru','shiv','str',
  // Titles / honorifics / abbreviations
  'mr','mrs','ms','dr','st','rd','ave','dept','gov','govt','corp','llc','inc','ltd','vs','aka','diy',
  'asap','rsvp','tba','tbd','faq','gps','usb','pdf','html','css','js','api','url','https','www',
  'avg','est','approx','misc','qty','amt','no','nos','vol','ed','eds','pp','ch',
  // Agencies / orgs / tech initialisms
  'usa','uk','eu','un','nato','nasa','cia','nsa','dna','rna','hiv','aids','covid','pc','tv','dvd',
  'cd','hd','sd','ui','ux','ceo','cfo','cto','hr','pr','qa','id','iq','eq','ok','vpn','cpu','gpu',
  'ssd','hdd','lcd','oled','wifi','lan','wan','ios','os','app','sms','mms','atm','ssn',
  // Chat slang
  'lol','omg','btw','imo','fyi','brb','ttyl','afaik','irl','dm','pm','yeet','sus','ghosting',
  'gonna','wanna','gotta','kinda','sorta','yeah','nah','yup','bae','tbh','idk','imo','lmao','rofl',
  // Common place names (countries / major cities)
  'asia','rome','paris','tokyo','oslo','bern','lima','quito','cairo','delhi','miami','dallas','boston',
  'seattle','denver','austin','phoenix','atlanta','chicago','houston','london','berlin','madrid','moscow',
  'sydney','dublin','ottawa','beijing','seoul','hanoi','jakarta','bangkok','dubai','riyadh',
  'tehran','baghdad','nairobi','lagos','accra','havana','bogota','santiago','mexico','canada','china',
  'india','japan','korea','spain','france','italy','germany','poland','ireland','scotland','wales',
  'england','russia','ukraine','brazil','argentina','chile','cuba','egypt','kenya','ghana','nigeria',
  'vietnam','thailand','malaysia','indonesia','philippines','australia','nyc','sf','dc','la','cali',
  'ohio','texas','florida','oregon','utah','idaho','iowa','hawaii','alaska','nevada','georgia','virginia',
  // Common given names / surnames that leak via online dict
  'smith','jones','brown','davis','miller','wilson','moore','taylor','anderson','thomas','jackson',
  'white','harris','martin','garcia','clark','lewis','lee','walker','hall','allen','young','king',
  'wright','scott','green','baker','adams','nelson','hill','campbell','mitchell','roberts','carter',
  'phillips','evans','turner','parker','collins','edwards','stewart','morris','murphy','cook','rogers',
  'morgan','peterson','cooper','reed','bailey','bell','kelly','howard','ward','richardson','wood',
  'watson','brooks','bennett','gray','james','hughes','price','myers','long','foster','sanders','ross',
  'powell','sullivan','russell','jenkins','perry','butler','barnes','john','mary','david','mike','steve',
  'tom','jim','joe','anna','lisa','kate','paul','luke','jack','jill','sue','nancy','helen',
  'alice','bruce','wayne','kevin','sarah','susan','emily','emma','olivia','sophia','daniel','matthew',
  'andrew','ryan','justin','brian','jason','jeffrey','timothy','anthony','charles','joseph','michael',
  'william','robert','richard','thomas','chris','alex','ben','mia','ava','zoe',
  // Fiction / celebrity tokens users may try
  'gandalf','frodo','bilbo','sauron','harry','potter','elon','musk','bezos','gates','jobs','biden',
  'trump','obama','clinton','putin'
]);

/** Common English function/content words allowed even at short length */
const ALLOWED_SHORT = new Set(
  ('am an as at be by do go he if in is it me my no of oh on or ox so to up us we '
   + 'the and for are but not you all can had her was one our out day get has him his how '
   + 'man new now old see way who boy did let put say she too use dad mom sun sky sea '
   + 'run red big few top low end set cut hit sit win yes yet own off odd ego era ice age '
   + 'art arm ash ask ape ant any apt arc ate awe axe aye bad bag ban bar bat bay bed bee '
   + 'beg bet bib bid big bin bit boa bog bow box bud bug bun bus buy bye cab can cap car '
   + 'cat cob cod cog cop cot cow cry cub cup cut dab dam den dew did dig dim din dip dog '
   + 'dot dry dub due dug duo dye ear eat eel egg ego elf elk elm emu end era eve ewe eye '
   + 'fad fan far fat fax fed fee few fib fig fin fir fit fix flu fly foe fog for fox fro '
   + 'fry fun fur gab gag gap gas gay gel gem get gig gin gnu god got gum gun gut guy gym '
   + 'had ham has hat hay hem hen her hew hid him hip his hit hob hod hoe hog hop hot how '
   + 'hub hue hug hum hut ice ilk ill imp ink inn ion ire irk its ivy jab jag jam jar jaw '
   + 'jay jet jig job jog jot joy jug jut keg ken key kid kin kit lab lad lag lap law lax '
   + 'lay led leg let lid lie lip lit lob log lot low lye mad man map mat may men met mid '
   + 'mix mob mod mop mow mud mug nab nag nap net new nib nil nip nit nod nor not now nub '
   + 'nun nut oaf oak oar oat odd ode off oft ohm oil old one orb ore our out ova owe owl '
   + 'own pad pal pan pap par pat paw pay pea peg pen pep per pet pew pie pig pin pit ply '
   + 'pod pop pot pox pro pry pub pug pun pup put rag ram ran rap rat raw ray red ref rep '
   + 'rib rid rig rim rip rob rod roe rot row rub rug rum run rut rye sad sag sap sat saw '
   + 'say sea set sew she shy sin sip sir sis sit six ski sky sly sob sod son sop sot sow '
   + 'soy spa spy sty sub sum sun sup tab tad tag tan tap tar tat taw tax tea ted tee ten '
   + 'the thy tic tie tin tip toe tog ton too top tot tow toy try tub tug tux two ugh urn '
   + 'use van vat vet vex via vie vim vow wad wag war was wax way web wed wee wet who why '
   + 'wig win wit woe wok won woo wow yak yam yap yaw yea yes yet yew yin yip you yow zap '
   + 'zen zig zip zoo').split(/\s+/)
);

function looksLikeAcronymOrInitialism(word){
  const w=String(word).toLowerCase().trim();
  if(w.length<2) return true;
  // All consonants of length 2–4 often initialisms (fbi, html-ish short forms) unless allowlisted
  if(w.length<=4 && !/[aeiouy]/.test(w) && !ALLOWED_SHORT.has(w) && !TWO_LETTER_WORDS.has(w)) return true;
  // Repeated same letter pairs like xx
  if(/^(.)\1$/.test(w)) return true;
  return false;
}

function isRejectedBonusWord(word){
  const w=String(word).toLowerCase().trim();
  if(!w) return true;
  if(REJECTED_BONUS_WORDS.has(w)) return true;
  if(looksLikeAcronymOrInitialism(w)) return true;
  if(/^[0-9]+$/.test(w)) return true;
  if(/[.\-\s']/.test(w)) return true;
  // Very short non-allowlisted tokens
  if(w.length<=2 && !TWO_LETTER_WORDS.has(w) && !ALLOWED_SHORT.has(w)) return true;
  return false;
}

/** True when API payload looks like a proper noun / name / place rather than a common word. */
function definitionLooksProper(data){
  try{
    if(!Array.isArray(data) || !data.length) return false;
    const entry=data[0];
    const word=String(entry.word||'');
    // Dictionary API capitalizes some proper nouns in the word field inconsistently;
    // rely more on meanings.
    let common=0, proper=0, total=0;
    for(const meaning of entry.meanings||[]){
      const pos=String(meaning.partOfSpeech||'').toLowerCase();
      for(const def of meaning.definitions||[]){
        const text=String(def.definition||'');
        if(!text) continue;
        total++;
        if(/proper noun|family name|surname|given name|first name|last name|place name|city in|capital of|country in|county in|male given|female given|hebrew|surname of/i.test(text) || pos==='name'){
          proper++;
        } else {
          common++;
        }
      }
    }
    if(total===0) return false;
    // Reject when every sense is proper-noun flavored, or majority proper with no solid common sense
    if(common===0 && proper>0) return true;
    if(proper>=2 && common===0) return true;
    return false;
  }catch{ return false; }
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
function showHome(){document.body.classList.remove('in-game');const sk=(typeof stageForLevel==='function'&&levels.length)?stageForLevel(state.currentLevel||0).key:'meadow';document.body.dataset.stage=sk;document.body.className=`stage-${sk}`;try{FX.setStage(sk)}catch(e){};$('gameScreen').hidden=true;$('homeScreen').hidden=false;$('overlay').classList.remove('show');updateHome()}
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
 try{ FX.setStage(stage.key); }catch(e){}
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
  playEffect('success');try{FX.burst('solve')}catch(e){}
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
   if(Array.isArray(data)&&data.length&&data[0].meanings){ if(definitionLooksProper(data)) return false; remember(); return true; }
  }
 }catch(e){}
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6000);
  const r=await fetch('https://api.datamuse.com/words?sp='+encodeURIComponent(key)+'&md=d&max=1',{signal:controller.signal});
  clearTimeout(timer);
  if(r.ok){
   const data=await r.json();
   if(Array.isArray(data)&&data[0]&&data[0].word===key&&Array.isArray(data[0].defs)&&data[0].defs.length){
    const defs=data[0].defs.join(' ');
    if(/proper noun|family name|surname|given name|city in|capital of|country in/i.test(defs)) return false;
    remember(); return true;
   }
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
 try{ FX.burst('solve'); }catch(e){}
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
function finishLevel(){try{FX.burst('level')}catch(e){}if(completionShown||solved.size<levels[level].words.length)return;completionShown=true;const final=level===levels.length-1;const wordCoins=solved.size*WORD_REWARD;const bonusCoins=[...extras].reduce((n,w)=>n+coinRewardForExtra(w),0);state.coins+=LEVEL_REWARD;state.unlockedLevel=Math.max(state.unlockedLevel,Math.min(level+1,levels.length-1));persistLevel();updateCoins();const points=wordCoins+LEVEL_REWARD+bonusCoins;$('modal').innerHTML=`<div class="level-finish"><div class="finish-leaf">✦</div><h2>${final?'All levels complete!':'Level complete!'}</h2><p>Beautifully done. The next part of your adventure awaits.</p><div class="stats"><div><strong>+${points}</strong><span>POINTS GAINED</span></div><div><strong>${extras.size}</strong><span>BONUS WORDS</span></div></div><p class="finish-detail">${wordCoins} word points · ${LEVEL_REWARD} level bonus${bonusCoins?` · ${bonusCoins} bonus-word coins`:''}</p><button class="action primary" id="next">${final?'Return to menu':`Continue to ${stageForLevel(level+1).name} · ${level+2} →`}</button></div>`;$('overlay').classList.add('show');$('next').onclick=()=>{$('overlay').classList.remove('show');if(final){showHome();return}state.currentLevel=Math.min(level+1,levels.length-1);saveState();level=state.currentLevel;renderGame()}}
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

/** Words solved on the current level only (in-game Words button). */
function openWordList(){
 const words=[...solved].sort();
 showListModal(
  'Level words',
  words,
  `Puzzle words found on level ${level+1} so far.`,
  {mode:'level'}
 );
}
/** Bonus words for the current level only. */
function openExtras(){
 const words=[...extras].sort();
 showListModal('Bonus words',words,'Bonus English words found on this level that are not part of the crossword.',{mode:'level'});
}
/** Collect word counts per level without fetching definitions. */
function collectWordsByLevel(){
 const byLevel=new Map(); // L -> {puzzle:Set, bonus:Set}
 const touch=(L)=>{
  if(!byLevel.has(L)) byLevel.set(L,{puzzle:new Set(),bonus:new Set()});
  return byLevel.get(L);
 };
 for(const [k,arr] of Object.entries(state.solvedByLevel||{})){
  const L=Number(k); if(!Number.isFinite(L)||!arr) continue;
  const bucket=touch(L);
  for(const w of arr) if(w) bucket.puzzle.add(String(w).toLowerCase());
 }
 for(const [k,arr] of Object.entries(state.extrasByLevel||{})){
  const L=Number(k); if(!Number.isFinite(L)||!arr) continue;
  const bucket=touch(L);
  for(const w of arr) if(w) bucket.bonus.add(String(w).toLowerCase());
 }
 return byLevel;
}

/** Home Words: browse Stage → Level → words (definitions load only for the opened level). */
function openGlobalWordList(){
 const byLevel=collectWordsByLevel();
 if(!byLevel.size){
  showModal('Words found','<p>No words yet. Keep playing!</p>');
  return;
 }
 openWordStages(byLevel);
}

function openWordStages(byLevel){
 // Group levels into stages (25 levels each)
 const stageMap=new Map(); // stageIndex -> {levels: number[], puzzle:n, bonus:n}
 for(const L of [...byLevel.keys()].sort((a,b)=>a-b)){
  const si=Math.floor(L/25);
  if(!stageMap.has(si)) stageMap.set(si,{levels:[],puzzle:0,bonus:0});
  const s=stageMap.get(si);
  s.levels.push(L);
  const b=byLevel.get(L);
  s.puzzle+=b.puzzle.size;
  s.bonus+=b.bonus.size;
 }
 const cards=[];
 for(const [si,s] of [...stageMap.entries()].sort((a,b)=>a[0]-b[0])){
  const base=STAGES[si%STAGES.length];
  const cycle=Math.floor(si/STAGES.length);
  const name=cycle?`${base[0]} ${cycle+1}`:base[0];
  const first=si*25+1;
  const last=Math.min(si*25+25, Math.max(...s.levels)+1);
  const total=s.puzzle+s.bonus;
  cards.push(`<button class="stage-card" data-word-stage="${si}"><strong>${esc(name)}</strong><span>Levels with finds · ${total} word${total===1?'':'s'} (${s.puzzle} puzzle · ${s.bonus} bonus)</span></button>`);
 }
 showModal('Words found',
  `<p class="stage-summary">Choose a stage, then a level. Definitions load only for the level you open.</p>
   <div class="stage-grid">${cards.join('')}</div>`);
 $('modal').querySelectorAll('[data-word-stage]').forEach(btn=>{
  btn.onclick=()=>openWordStageLevels(Number(btn.dataset.wordStage), byLevel);
 });
}

function openWordStageLevels(stageIndex, byLevel){
 const base=STAGES[stageIndex%STAGES.length];
 const cycle=Math.floor(stageIndex/STAGES.length);
 const name=cycle?`${base[0]} ${cycle+1}`:base[0];
 const first=stageIndex*25;
 const last=stageIndex*25+24;
 const rows=[];
 let stageTotal=0;
 for(let L=first; L<=last; L++){
  const b=byLevel.get(L);
  if(!b) continue;
  const p=b.puzzle.size, x=b.bonus.size, n=p+x;
  if(!n) continue;
  stageTotal+=n;
  rows.push(`<button class="level-row" data-word-level="${L}"><span class="level-row-num">#${L+1}</span><span class="level-row-meta">${p} puzzle · ${x} bonus · ${n} total</span></button>`);
 }
 if(!rows.length){
  showModal(name,'<p>No words recorded in this stage yet.</p><button class="action" id="backWordStages">← All stages</button>');
  $('modal').querySelector('#backWordStages').onclick=()=>openWordStages(byLevel);
  return;
 }
 showModal(name,
  `<p class="stage-summary">${stageTotal} word${stageTotal===1?'':'s'} across ${rows.length} level${rows.length===1?'':'s'}. Open a level to load its list and definitions.</p>
   <div class="level-list">${rows.join('')}</div>
   <button class="action" id="backWordStages">← All stages</button>`);
 const m=$('modal');
 m.querySelectorAll('[data-word-level]').forEach(btn=>{
  btn.onclick=()=>openWordLevelDetail(Number(btn.dataset.wordLevel), byLevel, stageIndex);
 });
 m.querySelector('#backWordStages').onclick=()=>openWordStages(byLevel);
}

async function openWordLevelDetail(L, byLevel, stageIndex){
 const b=byLevel.get(L)||{puzzle:new Set(),bonus:new Set()};
 const puzzle=[...b.puzzle].sort();
 const bonus=[...b.bonus].sort();
 const stage=stageForLevel(L);
 const entries=[
  ...puzzle.map(w=>({word:w,kind:'puzzle'})),
  ...bonus.map(w=>({word:w,kind:'bonus'}))
 ];
 const bodyHtml=entries.length
  ? entries.map((e,i)=>`<article class="word-definition rich" data-idx="${i}"><div class="word-def-head"><strong>${esc(e.word.toUpperCase())}</strong><span class="word-level-tag">${e.kind==='bonus'?'Bonus':'Puzzle'}</span></div><span class="word-def-text">…</span></article>`).join('')
  : '<p>No words on this level.</p>';

 $('modal').innerHTML=`<h2>${esc(stage.name)} · Level ${L+1}</h2>
  <p class="stage-summary">${puzzle.length} puzzle · ${bonus.length} bonus. Definitions load for this level only.</p>
  <div class="word-list" id="wordListBody">${bodyHtml}</div>
  <button class="action" id="backWordLevels">← ${esc(stage.name)}</button>
  <button class="action primary" id="closemodal">Close</button>
  <div class="app-version">Wordgrove v${APP_VERSION}</div>`;
 $('overlay').classList.add('show');
 $('closemodal').onclick=()=>$('overlay').classList.remove('show');
 $('backWordLevels').onclick=()=>openWordStageLevels(stageIndex, byLevel);

 // Lazy-load definitions in small concurrent batches to stay responsive
 const body=$('wordListBody');
 const unique=[...new Set(entries.map(e=>e.word))];
 const concurrency=4;
 let cursor=0;
 async function worker(){
  while(cursor<unique.length){
   const my=cursor++;
   const w=unique[my];
   let def;
   try{ def=await getDefinition(w); }
   catch{ def=['Definition unavailable']; }
   const text=Array.isArray(def)?def.join(' · '):String(def||'');
   body.querySelectorAll(`[data-idx]`).forEach(row=>{
    const idx=Number(row.dataset.idx);
    if(entries[idx]&&entries[idx].word===w){
     const span=row.querySelector('.word-def-text');
     if(span) span.textContent=text;
    }
   });
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency, unique.length)},()=>worker()));
}

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
function handleMove(e){if(!pointerActive||e.pointerId!==pointerId)return;const dx=e.clientX-startPoint.x,dy=e.clientY-startPoint.y;if(Math.hypot(dx,dy)>8)dragged=true;try{FX.swirlFromEvent(e)}catch(err){}const t=document.elementFromPoint(e.clientX,e.clientY),b=t?.closest?.('.letter');if(b&&$('wheel').contains(b))selectLetter(+b.dataset.index)}
function handleUp(e){if(!pointerActive||e.pointerId!==pointerId)return;try{FX.lastPX=null;FX.lastPY=null}catch(err){};const shouldSubmit=e.type==='pointerup'&&picked.length>=2;pointerActive=false;pointerId=null;startPoint=null;if(shouldSubmit)submit();else clearSelection()}

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
    <button class="action" id="changelogMenu">Features &amp; fixes</button>
    <button class="action" id="returnHome">⌂ Return to menu</button>
    ${dev?`<button class="action" id="devToolsOpen">⚒ Testing tools</button>`:''}
  </div>`);
 const m=$('modal');
 m.querySelector('#settingsOpen').onclick=openSoundSettings;
 m.querySelector('#levelsOpen').onclick=openLevels;
 m.querySelector('#changelogMenu').onclick=openChangelog;
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

const CHANGELOG = [
 {v:'3.5.16', items:[
  'Home Words found is now Stage → Level → words, so definitions load only for the level you open (much faster with large progress).'
 ]},
 {v:'3.5.15', items:[
  'Version badge forces update via network-first SW + one-time reload when a new build is installed.',
  'Home Words found list hardened; definitions load without CSS.escape.',
  'Stricter bonus-word filter: expanded name/place/slang blocklist; online dictionary rejects proper-noun-only entries.',
  'Stage audio redesigned around real-world themes (birds, wind, water, leaves, owls) instead of pitch-shifted clones.'
 ]},
 {v:'3.5.14', items:[
  'In-level Words list shows only words solved on the current level.',
  'Home “Words found” opens a full log with the level each word was found on (puzzle + bonus).',
  'Features & fixes list in Sound settings / Game menu.',
  'Service worker uses network-first for app files so reopening the site loads the latest build without clearing site data; progress stays in localStorage.'
 ]},
 {v:'3.5.13', items:[
  'README and docs track version + changelog.',
  'Coin icon and count outlined for visibility on every stage background.',
  'Audio labels: Music / Sounds; both On by default; prefs saved.',
  'Unique music and sound effects per stage.'
 ]},
 {v:'3.5.12', items:[
  'Level select jumps to the chosen level only (no accidental skip).',
  'Stage picker opens a per-stage level summary before play.',
  'Testing tools via ?dev=1 (auto-solve, unlock, jump, reset).'
 ]},
 {v:'3.5.11', items:[
  'Reject acronym, abbreviation, place-name, surname, and slang bonus words.',
  'Bonus coins: 0 for 2–3 letters, then 1 per letter after 3.',
  'Larger letter-wheel tiles scaled to avoid overlap.'
 ]},
 {v:'3.5.10', items:[
  'Definition hint reliability fix.'
 ]},
 {v:'3.4–3.5', items:[
  'Crossword layouts, swipe wheel, hints, definitions, extras, stages, PWA support.'
 ]}
];
function openChangelog(){
 const body=CHANGELOG.map(block=>
  `<section class="change-block"><h3>v${esc(block.v)}</h3><ul>${block.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></section>`
 ).join('');
 showModal('Features & fixes',`<div class="changelog">${body}</div>`);
}

function openSoundSettings(){
 showModal('Sound settings',`<div class="menu-options">
  <button class="action" id="musicToggle">Music: ${musicOn?'On':'Off'}</button>
  <button class="action" id="effectsToggle">Sounds: ${effectsOn?'On':'Off'}</button>
  <button class="action" id="changelogOpen">Features &amp; fixes</button>
 </div>`);
 const m=$('modal');
 m.querySelector('#musicToggle').onclick=()=>{toggleMusic();openSoundSettings()};
 m.querySelector('#effectsToggle').onclick=()=>{toggleEffects();openSoundSettings()};
 m.querySelector('#changelogOpen').onclick=openChangelog;
}

// Original, gentle synthesized ambience and tiny nature-inspired interaction sounds.
function audio(){
 if(!audioCtx){
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C) return null;
  audioCtx=new C();
 }
 if(audioCtx.state==='suspended') audioCtx.resume();
 return audioCtx;
}

/** Hybrid audio: optional real bed files under ./audio/ + procedural accents/fallback. */
const HybridAudio = {
  bed: null,          // HTMLAudioElement when file bed is playing
  bedStage: null,
  bedGain: 0.28,
  loading: null,
  // Preferred file names tried in order per stage
  bedFiles: {
    'meadow':          ['audio/meadow-bed.mp3','audio/meadow-bed.ogg','audio/meadow.mp3'],
    'field':           ['audio/field-bed.mp3','audio/field-bed.ogg','audio/field.mp3'],
    'moonlit-forest':  ['audio/moonlit-bed.mp3','audio/moonlit-bed.ogg','audio/moonlit-forest.mp3'],
    'waterfall':       ['audio/waterfall-bed.mp3','audio/waterfall-bed.ogg','audio/waterfall.mp3'],
    'autumn-grove':    ['audio/autumn-bed.mp3','audio/autumn-bed.ogg','audio/autumn-grove.mp3'],
    'crystal-lake':    ['audio/lake-bed.mp3','audio/lake-bed.ogg','audio/crystal-lake.mp3'],
    'misty-highlands': ['audio/highlands-bed.mp3','audio/highlands-bed.ogg','audio/misty-highlands.mp3'],
    'sunset-valley':   ['audio/sunset-bed.mp3','audio/sunset-bed.ogg','audio/sunset-valley.mp3']
  },
  async tryLoadBed(stage){
    const list=this.bedFiles[stage]||[];
    for(const url of list){
      try{
        const a=new Audio();
        a.loop=true; a.preload='auto'; a.volume=this.bedGain;
        const ok=await new Promise((resolve)=>{
          const onOk=()=>{ cleanup(); resolve(true); };
          const onErr=()=>{ cleanup(); resolve(false); };
          const cleanup=()=>{ a.removeEventListener('canplaythrough',onOk); a.removeEventListener('error',onErr); };
          a.addEventListener('canplaythrough',onOk,{once:true});
          a.addEventListener('error',onErr,{once:true});
          a.src=url;
          a.load();
          // timeout if hangs
          setTimeout(()=>resolve(false), 4000);
        });
        if(ok) return a;
      }catch(e){}
    }
    return null;
  },
  async setStage(stage){
    if(!musicOn){ this.stopBed(); return; }
    if(this.bedStage===stage && this.bed && !this.bed.paused) return;
    this.stopBed();
    this.bedStage=stage;
    const el=await this.tryLoadBed(stage);
    if(el && musicOn){
      this.bed=el;
      try{ await el.play(); }catch(e){ /* autoplay may need gesture */ }
    }
  },
  stopBed(){
    if(this.bed){
      try{ this.bed.pause(); this.bed.src=''; }catch(e){}
      this.bed=null;
    }
    this.bedStage=null;
  },
  setEnabled(on){
    if(!on) this.stopBed();
    else if(document.body.dataset.stage) this.setStage(document.body.dataset.stage);
  }
};

function noiseBuffer(seconds=1){
 const c=audio(); if(!c) return null;
 const n=Math.floor(c.sampleRate*seconds);
 const buf=c.createBuffer(1,n,c.sampleRate);
 const data=buf.getChannelData(0);
 let last=0;
 for(let i=0;i<n;i++){
  // light brown-ish noise
  const white=Math.random()*2-1;
  last=(last+0.02*white)/1.02;
  data[i]=last*3.5;
 }
 return buf;
}
function playNoiseBurst({duration=0.2, gain=0.03, type='bandpass', freq=1200, q=4, attack=0.01, startAt=0}={}){
 const c=audio(); if(!c) return;
 const buf=noiseBuffer(Math.max(duration,0.05)); if(!buf) return;
 const src=c.createBufferSource(); src.buffer=buf;
 const filter=c.createBiquadFilter(); filter.type=type; filter.frequency.value=freq; filter.Q.value=q;
 const g=c.createGain();
 const t0=c.currentTime+startAt;
 g.gain.setValueAtTime(0.0001,t0);
 g.gain.exponentialRampToValueAtTime(gain,t0+attack);
 g.gain.exponentialRampToValueAtTime(0.0001,t0+duration);
 src.connect(filter); filter.connect(g); g.connect(c.destination);
 src.start(t0); src.stop(t0+duration+0.02);
}
function playTone({freq=440, duration=0.2, type='sine', gain=0.03, attack=0.01, detune=0, startAt=0, slideTo=null}={}){
 const c=audio(); if(!c) return;
 const o=c.createOscillator(), g=c.createGain();
 o.type=type; o.frequency.value=freq; o.detune.value=detune;
 const t0=c.currentTime+startAt;
 g.gain.setValueAtTime(0.0001,t0);
 g.gain.exponentialRampToValueAtTime(gain,t0+attack);
 g.gain.exponentialRampToValueAtTime(0.0001,t0+duration);
 if(slideTo!=null) o.frequency.exponentialRampToValueAtTime(Math.max(40,slideTo), t0+duration*0.9);
 o.connect(g); g.connect(c.destination);
 o.start(t0); o.stop(t0+duration+0.02);
}

function playEffect(kind='button'){
 if(!effectsOn) return;
 const stage=document.body.dataset.stage||'meadow';
 // User-tuned SFX map
 if(kind==='letter'){
  if(stage==='meadow' || stage==='field'){
   // AUD-M1 style close chirps
   playTone({freq:1700+Math.random()*500, duration:0.07, type:'sine', gain:0.028, slideTo:2300+Math.random()*200});
   playTone({freq:2100, duration:0.05, type:'sine', gain:0.014, startAt:0.05, slideTo:1500});
  } else if(stage==='moonlit-forest'){
   // soft wood / quiet night
   playTone({freq:200+Math.random()*30, duration:0.14, type:'triangle', gain:0.022});
  } else if(stage==='waterfall'){
   // AUD-W1 splash/drip accent
   playNoiseBurst({duration:0.1, gain:0.03, freq:2200, q:2.5, type:'bandpass'});
   playTone({freq:880, duration:0.08, type:'sine', gain:0.014, slideTo:420});
  } else if(stage==='autumn-grove'){
   // leaf crunch
   playNoiseBurst({duration:0.11, gain:0.038, freq:1600, q:1.1, type:'bandpass'});
   playNoiseBurst({duration:0.06, gain:0.02, freq:3000, q:2, type:'highpass', startAt:0.03});
  } else if(stage==='crystal-lake'){
   // rocky shore step
   playNoiseBurst({duration:0.09, gain:0.03, freq:900, q:1.4, type:'bandpass'});
   playTone({freq:140, duration:0.08, type:'triangle', gain:0.018});
  } else if(stage==='misty-highlands'){
   playNoiseBurst({duration:0.12, gain:0.022, freq:500, q:0.7, type:'bandpass'});
  } else {
   playTone({freq:640, duration:0.1, type:'sine', gain:0.024, slideTo:480});
  }
  return;
 }
 if(kind==='button'){
  if(stage==='autumn-grove') playNoiseBurst({duration:0.08, gain:0.025, freq:1500, q:1.3, type:'bandpass'});
  else if(stage==='waterfall') playNoiseBurst({duration:0.07, gain:0.02, freq:2000, q:2, type:'bandpass'});
  else if(stage==='crystal-lake') playNoiseBurst({duration:0.07, gain:0.022, freq:700, q:1.2, type:'bandpass'});
  else playTone({freq:700, duration:0.08, type:'sine', gain:0.022, slideTo:360});
  return;
 }
 // success
 if(stage==='meadow'||stage==='field'){
  playTone({freq:1600, duration:0.09, type:'sine', gain:0.03, slideTo:2100});
  playTone({freq:2000, duration:0.1, type:'sine', gain:0.022, startAt:0.08, slideTo:2600});
 } else if(stage==='moonlit-forest'){
  playTone({freq:280, duration:0.28, type:'sine', gain:0.03, slideTo:220});
  playTone({freq:220, duration:0.32, type:'sine', gain:0.024, startAt:0.35, slideTo:180});
 } else if(stage==='waterfall'){
  playNoiseBurst({duration:0.28, gain:0.04, freq:1700, q:0.8, type:'bandpass'});
  playTone({freq:600, duration:0.18, type:'sine', gain:0.02, startAt:0.05, slideTo:900});
 } else if(stage==='autumn-grove'){
  playNoiseBurst({duration:0.2, gain:0.04, freq:1400, q:1, type:'bandpass'});
  playNoiseBurst({duration:0.12, gain:0.03, freq:2800, q:1.5, type:'highpass', startAt:0.08});
 } else if(stage==='crystal-lake'){
  playNoiseBurst({duration:0.12, gain:0.03, freq:800, q:1, type:'bandpass'});
  playTone({freq:420, duration:0.15, type:'triangle', gain:0.02, startAt:0.04});
 } else {
  playTone({freq:520, duration:0.18, type:'sine', gain:0.028, slideTo:700});
 }
}

let musicChord=0;
let ambientNodes=[];

function stopAmbientNodes(){
 for(const n of ambientNodes){
  try{ n.stop?.(); }catch{}
  try{ n.disconnect?.(); }catch{}
 }
 ambientNodes=[];
}

function startStageAmbient(){
 // Procedural bed layer (always available). When a real file bed is playing,
 // keep this quieter so hybrid = file + light accents.
 if(!musicOn) return;
 const c=audio(); if(!c) return;
 const stage=document.body.dataset.stage||'meadow';
 const now=c.currentTime;
 const hasFileBed = !!(HybridAudio.bed && !HybridAudio.bed.paused);
 const bedMul = hasFileBed ? 0.35 : 1.0;

 function addNoiseLoop({gain=0.008, freq=800, q=1, type='bandpass', lfoRate=0.1, lfoDepth=0.004}={}){
  const buf=noiseBuffer(2); if(!buf) return;
  const src=c.createBufferSource(); src.buffer=buf; src.loop=true;
  const filter=c.createBiquadFilter(); filter.type=type; filter.frequency.value=freq; filter.Q.value=q;
  const g=c.createGain(); g.gain.value=gain*bedMul;
  const lfo=c.createOscillator(); const lfoG=c.createGain();
  lfo.frequency.value=lfoRate; lfoG.gain.value=lfoDepth*bedMul;
  lfo.connect(lfoG); lfoG.connect(g.gain);
  src.connect(filter); filter.connect(g); g.connect(c.destination);
  src.start(now); lfo.start(now);
  ambientNodes.push(src,lfo);
 }

 // Stage beds tuned to user choices
 if(stage==='meadow'){
  // AUD-M2 denser chorus feel via layered air + will chirp in musicNote
  addNoiseLoop({gain:0.007, freq:1400, q:0.8, type:'bandpass', lfoRate:0.07, lfoDepth:0.003});
  addNoiseLoop({gain:0.004, freq:2800, q:2, type:'bandpass', lfoRate:0.12, lfoDepth:0.002});
 } else if(stage==='field'){
  addNoiseLoop({gain:0.008, freq:3200, q:2.2, type:'bandpass', lfoRate:0.14, lfoDepth:0.003});
  addNoiseLoop({gain:0.005, freq:700, q:0.6, type:'lowpass', lfoRate:0.05, lfoDepth:0.002});
 } else if(stage==='moonlit-forest'){
  // AUD-N2 quieter, more space
  addNoiseLoop({gain:0.008, freq:260, q:0.55, type:'bandpass', lfoRate:0.04, lfoDepth:0.004});
 } else if(stage==='waterfall'){
  // AUD-W2: quieter filtered roar (bed), not full blast
  addNoiseLoop({gain:0.01, freq:900, q:0.55, type:'bandpass', lfoRate:0.15, lfoDepth:0.003});
  addNoiseLoop({gain:0.005, freq:2800, q:0.9, type:'highpass', lfoRate:0.22, lfoDepth:0.002});
 } else if(stage==='autumn-grove'){
  // AUD-A1 dry leaf rustle + wind
  addNoiseLoop({gain:0.01, freq:2000, q:1.1, type:'bandpass', lfoRate:0.11, lfoDepth:0.004});
  addNoiseLoop({gain:0.005, freq:450, q:0.7, type:'lowpass', lfoRate:0.06, lfoDepth:0.002});
 } else if(stage==='crystal-lake'){
  // No water bed — open air + occasional raven-like calls in musicNote
  addNoiseLoop({gain:0.005, freq:600, q:0.7, type:'bandpass', lfoRate:0.05, lfoDepth:0.002});
  addNoiseLoop({gain:0.003, freq:1800, q:1.5, type:'bandpass', lfoRate:0.08, lfoDepth:0.001});
 } else if(stage==='misty-highlands'){
  addNoiseLoop({gain:0.014, freq:400, q:0.5, type:'bandpass', lfoRate:0.04, lfoDepth:0.006});
 } else {
  addNoiseLoop({gain:0.007, freq:900, q:0.8, type:'bandpass', lfoRate:0.07, lfoDepth:0.003});
 }
}

function musicNote(){
 if(!musicOn) return;
 const stage=document.body.dataset.stage||'meadow';
 musicChord++;
 const hasFileBed = !!(HybridAudio.bed && !HybridAudio.bed.paused);
 // When real bed is playing, only sparse accents
 if(hasFileBed && musicChord % 2 === 0) return;

 if(stage==='meadow'){
  // denser bird-like phrases (AUD-M2 bed character via events)
  const base=1500+Math.random()*600;
  playTone({freq:base, duration:0.08, type:'sine', gain:0.018, slideTo:base+400});
  playTone({freq:base+250, duration:0.06, type:'sine', gain:0.012, startAt:0.09, slideTo:base});
  if(musicChord%2===0) playTone({freq:base-150, duration:0.07, type:'sine', gain:0.01, startAt:0.2, slideTo:base+100});
 } else if(stage==='field'){
  for(let i=0;i<4;i++) playNoiseBurst({duration:0.025, gain:0.012, freq:4200, q:11, type:'bandpass', startAt:i*0.06});
 } else if(stage==='moonlit-forest'){
  // AUD-N2 rare owl
  if(musicChord%3===0){
   playTone({freq:300, duration:0.35, type:'sine', gain:0.02, slideTo:260});
   playTone({freq:250, duration:0.4, type:'sine', gain:0.016, startAt:0.45, slideTo:210});
  }
 } else if(stage==='waterfall'){
  // light drip accents over quiet bed
  playNoiseBurst({duration:0.2, gain:0.018, freq:1500+Math.random()*600, q:0.9, type:'bandpass'});
 } else if(stage==='autumn-grove'){
  playNoiseBurst({duration:0.45, gain:0.025, freq:1700, q:0.95, type:'bandpass'});
  playNoiseBurst({duration:0.2, gain:0.018, freq:2900, q:1.3, type:'highpass', startAt:0.12});
 } else if(stage==='crystal-lake'){
  // distant raven-like rough call (no water)
  if(musicChord%2===0){
   playTone({freq:280, duration:0.22, type:'sawtooth', gain:0.012, slideTo:220});
   playTone({freq:240, duration:0.18, type:'sawtooth', gain:0.01, startAt:0.2, slideTo:190});
  }
 } else if(stage==='misty-highlands'){
  playNoiseBurst({duration:1.0, gain:0.03, freq:320+Math.random()*120, q:0.5, type:'bandpass'});
 } else {
  playTone({freq:196, duration:1.0, type:'sine', gain:0.01});
  playTone({freq:247, duration:1.0, type:'sine', gain:0.008, startAt:0.05});
 }
}

function stopMusicForBackground(){
 clearInterval(musicTimer); musicTimer=null;
 stopAmbientNodes();
 HybridAudio.stopBed();
 if(audioCtx&&audioCtx.state==='running') audioCtx.suspend().catch(()=>{});
}
function resumeMusic(){
 if(!musicOn||document.hidden) return;
 const c=audio();
 if(c&&c.state==='suspended') c.resume().catch(()=>{});
 const stage=document.body.dataset.stage||'meadow';
 HybridAudio.setStage(stage).then(()=>{
  if(!musicTimer){
   startStageAmbient();
   musicNote();
   const intervals={
    'meadow':2600,'field':2800,'moonlit-forest':5600,'waterfall':3000,
    'autumn-grove':3400,'crystal-lake':4200,'misty-highlands':5000,'sunset-valley':4000
   };
   musicTimer=setInterval(musicNote, intervals[stage]||3600);
  }
 });
}
function restartMusicForStage(){
 if(!musicOn) return;
 clearInterval(musicTimer); musicTimer=null;
 stopAmbientNodes();
 musicChord=0;
 resumeMusic();
}
function toggleMusic(){
 musicOn=!musicOn; saveAudioPrefs();
 if(musicOn){ audio(); restartMusicForStage(); }
 else stopMusicForBackground();
}
function toggleEffects(){ effectsOn=!effectsOn; saveAudioPrefs(); }

$('playBtn').addEventListener('click',startGame);$('homeMenuBtn').addEventListener('click',openGameMenu);$('gameMenuBtn').addEventListener('click',openGameMenu);$('levelsBtn').addEventListener('click',openLevels);if($('globalWordsBtn'))$('globalWordsBtn').addEventListener('click',openGlobalWordList);if($('homeWordsCard'))$('homeWordsCard').addEventListener('click',openGlobalWordList);$('shuffle').addEventListener('click',shuffle);$('hint').addEventListener('click',openHints);$('wordListBtn').addEventListener('click',openWordList);$('extrasBtn').addEventListener('click',openExtras);$('homeHelp').addEventListener('click',()=>showModal('How to play','Swipe across the letter wheel to spell words. Tap a crossword word to select it for definition hints or a letter reveal. Solve every crossword word to finish a level. Bonus words earn coins.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMusicForBackground();else resumeMusic()});window.addEventListener('pagehide',stopMusicForBackground);window.addEventListener('pageshow',()=>{if(!document.hidden)resumeMusic()});
document.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('.letter'))playEffect('button')});
$('wheel').addEventListener('pointerdown',handleDown);document.addEventListener('pointermove',handleMove,{passive:false});document.addEventListener('pointerup',handleUp);document.addEventListener('pointercancel',handleUp);

// ---- Lightweight stage particle FX (canvas 2d, capped count) ----
// ---- Lightweight stage particle FX (canvas 2d, capped count) ----
const FX = {
  particles: [],
  max: 36,
  last: 0,
  stage: 'meadow',
  reduced: false,
  lastPX: null,
  lastPY: null,
  init(){
    this.canvas = $('fxCanvas');
    if(!this.canvas) return;
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.resize();
    window.addEventListener('resize', ()=>this.resize(), { passive:true });
    document.addEventListener('pointerdown', (e)=>{
      if(e.target.closest('button, .letter, .cross-cell, .modal, .action, input, .word-list, .stage-card, .level-row')) return;
      this.impulse(e.clientX, e.clientY, 1.6);
    }, { passive:true });
    const bg = $('bgMotion');
    if(bg && !this.reduced) bg.classList.add('animate');
    requestAnimationFrame((t)=>this.frame(t));
  },
  resize(){
    if(!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio||1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w+'px';
    this.canvas.style.height = h+'px';
    this.dpr = dpr;
    this.w = w; this.h = h;
  },
  applyBackground(key){
    const el = $('bgMotion');
    if(!el) return;
    const k = key || 'meadow';
    const candidates = ['bg-'+k+'.jpg', './bg-'+k+'.jpg', 'bg/'+k+'.jpg'];
    const tryNext = (i)=>{
      if(i>=candidates.length){ console.warn('Wordgrove: background missing for', k); return; }
      const src = candidates[i];
      const img = new Image();
      img.onload = ()=>{ el.style.backgroundImage = 'url("'+src+'")'; };
      img.onerror = ()=>tryNext(i+1);
      img.src = src;
    };
    tryNext(0);
    if(!this.reduced) el.classList.add('animate');
  },
  setStage(key){
    this.stage = key || 'meadow';
    this.applyBackground(this.stage);
    this.particles = [];
    if(this.reduced) return;
    const n = this.stage==='autumn-grove' ? 34 : 28;
    for(let i=0;i<n;i++) this.particles.push(this.spawn(true));
  },
  spawn(randomY){
    const s = this.stage;
    const w = this.w || 360, h = this.h || 640;
    const p = {
      x: Math.random()*w,
      y: randomY ? Math.random()*h : -20,
      vx: (Math.random()-0.5)*0.25,
      vy: 0.2 + Math.random()*0.35,
      r: 2.5 + Math.random()*2.5,
      a: 0.65,
      rot: Math.random()*Math.PI*2,
      vr: (Math.random()-0.5)*0.05,
      kind: 'dot',
      color: '#e8d48a'
    };
    if(s==='autumn-grove'){
      p.kind='leaf'; p.r=5+Math.random()*5; p.vy=0.45+Math.random()*0.7;
      p.color=['#c45c26','#d4762c','#b33b1a','#e8a04a','#a34018'][(Math.random()*5)|0];
    } else if(s==='meadow' || s==='field'){
      p.kind='pollen'; p.r=2+Math.random()*2.2; p.vy=0.08+Math.random()*0.18;
      p.color=Math.random()>0.5 ? '#f0e090' : '#cfe88a';
    } else if(s==='waterfall'){
      p.kind='mist'; p.r=2+Math.random()*2.5; p.vy=0.55+Math.random()*0.85;
      p.color='#b8dcf5'; p.a=0.55;
    } else if(s==='crystal-lake'){
      p.kind='spark'; p.r=1.8+Math.random()*2; p.vy=0.1+Math.random()*0.2;
      p.color='#9fd0ff';
    } else if(s==='moonlit-forest'){
      p.kind='mote'; p.r=1.8+Math.random()*2.2; p.vy=0.05+Math.random()*0.12;
      p.color='#a8c8ff';
    } else if(s==='misty-highlands'){
      p.kind='fog'; p.r=12+Math.random()*18; p.vy=0.04+Math.random()*0.08;
      p.color='#d8e0dc'; p.a=0.28;
    } else {
      p.kind='ember'; p.r=2+Math.random()*2.5; p.vy=0.06+Math.random()*0.14;
      p.color=Math.random()>0.5 ? '#ffb060' : '#ffd078';
    }
    return p;
  },
  impulse(x,y,strength=1){
    if(this.reduced) return;
    for(const p of this.particles){
      const dx=p.x-x, dy=p.y-y;
      const d2=dx*dx+dy*dy;
      if(d2>24000) continue;
      const d=Math.sqrt(d2)+0.01;
      p.vx += (dx/d)*strength*1.2;
      p.vy += (dy/d)*strength*0.75;
    }
  },
  swirlFromEvent(e){
    if(this.reduced) return;
    const wheel = $('wheel');
    if(!wheel) return;
    const r = wheel.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;
    if(Math.hypot(e.clientX-cx, e.clientY-cy) > Math.max(r.width, r.height)*0.95) {
      this.lastPX = e.clientX; this.lastPY = e.clientY;
      return;
    }
    let mdx = e.movementX, mdy = e.movementY;
    if(mdx==null || ((mdx===0 && mdy===0) && this.lastPX!=null)){
      mdx = e.clientX - (this.lastPX||e.clientX);
      mdy = e.clientY - (this.lastPY||e.clientY);
    }
    this.lastPX = e.clientX; this.lastPY = e.clientY;
    if(!mdx && !mdy) return;
    const force = Math.min(1.8, Math.hypot(mdx, mdy) * 0.045);
    if(force < 0.03) return;
    const ang = Math.atan2(mdy, mdx);
    for(const p of this.particles){
      const dist = Math.hypot(p.x-cx, p.y-cy);
      if(dist > 200) continue;
      const falloff = (1 - dist/200);
      p.vx += Math.cos(ang) * force * falloff;
      p.vy += Math.sin(ang) * force * falloff * 0.65;
    }
  },
  burst(kind='solve'){
    if(this.reduced) return;
    const board = $('board');
    let cx = this.w*0.5, cy = this.h*0.35;
    if(board){
      const r = board.getBoundingClientRect();
      cx = r.left + r.width/2;
      cy = r.top + r.height/2;
    }
    const extra = kind==='level' ? 20 : 12;
    for(let i=0;i<extra;i++){
      const p = this.spawn(false);
      p.x = cx + (Math.random()-0.5)*90;
      p.y = cy + (Math.random()-0.5)*50;
      p.vx = (Math.random()-0.5)*3.5;
      p.vy = -1.2 - Math.random()*2.8;
      p.a = 0.9;
      p.r *= 1.35;
      this.particles.push(p);
    }
    while(this.particles.length > this.max+24) this.particles.shift();
  },
  frame(t){
    requestAnimationFrame((nt)=>this.frame(nt));
    if(!this.ctx || this.reduced) return;
    if(!this.w) this.resize();
    const dt = Math.min(40, t - (this.last||t)) || 16;
    this.last = t;
    const ctx = this.ctx, dpr = this.dpr || 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    if(this.particles.length < this.max-4){
      this.particles.push(this.spawn(false));
    }
    for(let i=this.particles.length-1; i>=0; i--){
      const p = this.particles[i];
      p.x += p.vx * (dt/16);
      p.y += p.vy * (dt/16);
      p.rot += p.vr;
      p.vx *= 0.98;
      p.vy *= 0.995;
      let dead = (p.y > this.h + 30) || (p.y < -40) || (p.x < -50) || (p.x > this.w + 50);
      if(dead){
        this.particles[i] = this.spawn(false);
        const q = this.particles[i];
        if(Math.random()<0.7){ q.y = -15; q.x = Math.random()*this.w; }
        else { q.x = Math.random()<0.5 ? -15 : this.w+15; q.y = Math.random()*this.h*0.7; }
        continue;
      }
      ctx.globalAlpha = Math.max(0.12, Math.min(1, p.a));
      ctx.fillStyle = p.color || '#e8d48a';
      if(p.kind==='leaf'){
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r*1.5, p.r*0.65, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
};

async function boot(){try{const [lr,dr,df]=await Promise.all([fetch('./levels.json'),fetch('./dictionary.json'),fetch('./definitions.json').catch(()=>null)]);if(!lr.ok||!dr.ok)throw Error('Puzzle files unavailable');levels=await lr.json();dictionary=new Set(await dr.json());if(df?.ok)definitions=await df.json();try{definitions={...definitions,...JSON.parse(localStorage.getItem('wordgrove-definitions')||'{}')}}catch{}state.currentLevel=Math.min(state.currentLevel,levels.length-1);state.unlockedLevel=Math.min(state.unlockedLevel,levels.length-1);updateHome();showHome();try{FX.init();FX.setStage(document.body.dataset.stage||'meadow')}catch(e){};const hv=$('homeVersion');if(hv)hv.textContent=`Wordgrove v${APP_VERSION}`;
 document.title=`Wordgrove v${APP_VERSION}`;
 try{ if(new URLSearchParams(location.search).get('dev')==='1') localStorage.setItem('wordgrove-dev','1'); }catch{}
if('serviceWorker'in navigator){
  navigator.serviceWorker.register('./sw.js?v='+APP_VERSION).then(reg=>{
    reg.update().catch(()=>{});
    // If a new worker is waiting, activate it
    if(reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
    reg.addEventListener('updatefound',()=>{
      const nw=reg.installing;
      if(!nw) return;
      nw.addEventListener('statechange',()=>{
        if(nw.state==='installed'&&navigator.serviceWorker.controller){
          // New version ready — soft reload once so version badge updates
          try{
            const flag='wordgrove-reloaded-'+APP_VERSION;
            if(!sessionStorage.getItem(flag)){
              sessionStorage.setItem(flag,'1');
              location.reload();
            }
          }catch{ location.reload(); }
        }
      });
    });
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener('message',ev=>{
    if(ev.data&&ev.data.type==='RELOAD') location.reload();
  });
}}catch(e){$('homeScreen').innerHTML='<div class="hero"><h1>Wordgrove</h1><p>The puzzle library could not be loaded. Connect to the internet once, then refresh.</p></div>'}}
window.addEventListener('resize',()=>{if(levels.length&&!$('gameScreen').hidden){renderCrossword();drawWheel()}});boot();
