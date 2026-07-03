const STORAGE_KEY='ritm-habits-v1';
const GROUPS_KEY='ritm-collapsed-groups-v1';
const GROUP_NAMES_KEY='ritm-group-names-v1';
const colors=[
  ['#e5574f','Красный'],['#52aa69','Зелёный'],['#3478d4','Синий'],
  ['#f1bd36','Жёлтый'],['#d64bb7','Пурпурный'],['#45b7dc','Голубой'],
  ['#ee873c','Оранжевый'],['#ee7ca7','Розовый'],['#9bcf3b','Лайм'],
  ['#61c9a8','Мятный'],['#7d72d9','Фиолетовый'],['#28a9a5','Бирюзовый']
];
const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=new Date();today.setHours(12,0,0,0);
const seed=[
  {id:crypto.randomUUID(),name:'Стакан воды утром',color:colors[1][0],createdAt:dayKey(today),history:{}},
  {id:crypto.randomUUID(),name:'Читать 20 минут',color:colors[10][0],createdAt:dayKey(today),history:{}},
  {id:crypto.randomUUID(),name:'Тренировка',color:colors[3][0],createdAt:dayKey(today),history:{}}
];
function normalizeHabit(h){
  const history={...(h.done||{}),...(h.history||{})};
  const fallback=new Date(today);fallback.setDate(fallback.getDate()-6);
  const createdAt=h.createdAt||Object.keys(history).sort()[0]||dayKey(fallback);
  const cursor=new Date(`${createdAt}T12:00:00`);
  while(cursor<=today){const key=dayKey(cursor);if(!(key in history))history[key]=false;cursor.setDate(cursor.getDate()+1)}
  const {done,...habit}=h;return {...habit,group:(h.group||'').trim(),type:h.type||'binary',chartType:h.chartType||'line',includeInSummary:h.includeInSummary!==false,goal:Math.max(1,Math.round(Number(h.goal)||1)),createdAt,history};
}
let habits=(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||seed).map(normalizeHabit);
let collapsedGroups=new Set(JSON.parse(localStorage.getItem(GROUPS_KEY)||'[]'));
let groupNames=JSON.parse(localStorage.getItem(GROUP_NAMES_KEY)||'[]').filter(name=>name&&name!=='Без группы');
habits.forEach(h=>{if(h.group&&!groupNames.includes(h.group))groupNames.push(h.group)});
let selectedColor=colors[1][0];
let pendingDeleteId=null;
let editingId=null;
let selectedType='binary';
let selectedGoal=1;
let percentTarget=null;
let quantityTarget=null;
let weekOffset=0;
let selectedStatsIds=[];
let statsInitialized=false;
let editingGroupName=null;
let draggedHabitId=null;
const $=s=>document.querySelector(s);
const days=[...Array(7)].map((_,i)=>{const d=new Date(today);d.setDate(d.getDate()-i);return d});
const labels=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const trashIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>';
const editIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Zm9-13 4 4"/></svg>';
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(habits))}
function saveGroups(){localStorage.setItem(GROUPS_KEY,JSON.stringify([...collapsedGroups]))}
function saveGroupNames(){localStorage.setItem(GROUP_NAMES_KEY,JSON.stringify(groupNames))}
function escapeHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function valueFor(h,key){if(h.type==='percent')return Math.min(100,Number(h.history[key])||0);if(h.type==='quantity')return Math.min(100,(Number(h.history[key])||0)/(Number(h.goal)||1)*100);return h.history[key]?100:0}
function displayNumber(value){return Number.isInteger(Number(value))?Number(value):Number(value).toFixed(1)}
function habitRow(h){return `<article class="habit-row" draggable="true" data-habit-drag="${h.id}" style="--habit:${h.color}">
  <div class="habit-main"><button class="today-toggle ${h.type!=='binary'?'percent':''} ${valueFor(h,dayKey(days[0]))===0?'is-zero':''} ${valueFor(h,dayKey(days[0]))===100?'done':''}" style="--progress:${valueFor(h,dayKey(days[0]))*3.6}deg" data-toggle="${h.id}" aria-label="Отметить выполнение сегодня"></button><div class="habit-copy"><h3>${escapeHtml(h.name)}</h3><div class="habit-progress" aria-label="Сегодня выполнено на ${Math.round(valueFor(h,dayKey(days[0])))} процентов"><span style="width:${valueFor(h,dayKey(days[0]))}%"></span></div></div></div>
  ${days.map((d,i)=>{const key=dayKey(d),v=valueFor(h,key),label=v===0?'×':(v===100?'✓':'');return `<button class="day-mark ${h.type!=='binary'?'percent':''} ${i>0?'past':''} ${v===0?'is-zero':''} ${v===100?'done':''}" style="--progress:${v*3.6}deg;--fill:${v}%" data-day="${key}" data-id="${h.id}" aria-label="Изменить отметку за ${d.toLocaleDateString('ru')}, прогресс ${Math.round(v)} процентов">${label}</button>`}).join('')}
  <div class="row-actions"><button class="edit-button" data-edit="${h.id}" aria-label="Редактировать ${escapeHtml(h.name)}">${editIcon}</button><button class="delete-button" data-delete="${h.id}" aria-label="Удалить ${escapeHtml(h.name)}">${trashIcon}</button></div>
</article>`}
function render(){
  $('#todayLabel').textContent=new Intl.DateTimeFormat('ru',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  $('#dateRow').innerHTML=days.map(d=>`<div class="date"><strong>${d.getDate()}</strong><span>${labels[d.getDay()]}</span></div>`).join('');
  const ungrouped=habits.filter(h=>!h.group),groups=new Map(groupNames.map(name=>[name,[]]));habits.filter(h=>h.group).forEach(h=>{if(!groups.has(h.group))groups.set(h.group,[]);groups.get(h.group).push(h)});
  $('#habitList').innerHTML=`<div class="ungrouped-list" data-drop-group="">${ungrouped.map(habitRow).join('')}</div>`+[...groups].map(([group,items])=>`<section class="habit-group ${collapsedGroups.has(group)?'collapsed':''}" data-drop-group="${escapeHtml(group)}"><div class="group-header"><button class="group-toggle" data-group-toggle="${escapeHtml(group)}" aria-expanded="${!collapsedGroups.has(group)}"><span class="group-chevron" aria-hidden="true"></span><strong>${escapeHtml(group)}</strong></button><button class="group-edit" data-group-edit="${escapeHtml(group)}" aria-label="Редактировать группу ${escapeHtml(group)}">${editIcon}</button></div><div class="group-items">${items.map(habitRow).join('')}</div></section>`).join('');
  $('#emptyState').hidden=habits.length>0;$('#dateRow').hidden=habits.length===0;
  const summaryHabits=habits.filter(h=>h.includeInSummary),total=summaryHabits.reduce((sum,h)=>sum+valueFor(h,dayKey(days[0])),0);const p=summaryHabits.length?Math.round(total/summaryHabits.length):0;
  $('#progressPercent').textContent=`${p}%`;$('#progressRing').style.setProperty('--p',`${p*3.6}deg`);
  $('.summary').style.setProperty('--summary-fill',`${p}%`);
  $('#summaryText').textContent=summaryHabits.length?`${p}% общего прогресса`:(habits.length?'Нет привычек в подсчёте':'Начнём с малого');
  renderStats();
}
function getStatsDays(){const end=new Date(today);end.setDate(end.getDate()+weekOffset*7);return [...Array(7)].map((_,i)=>{const d=new Date(end);d.setDate(d.getDate()-(6-i));return d})}
function formatWeekRange(range){const start=range[0],end=range[6],sameMonth=start.getMonth()===end.getMonth();const month=d=>new Intl.DateTimeFormat('ru',{month:'long'}).format(d);return sameMonth?`${start.getDate()}–${end.getDate()} ${month(end)}`:`${start.getDate()} ${month(start)} — ${end.getDate()} ${month(end)}`}
function renderStats(){
  selectedStatsIds=selectedStatsIds.filter(id=>habits.some(h=>h.id===id));
  if(!statsInitialized&&habits.length){selectedStatsIds=[habits[0].id];statsInitialized=true}
  const selected=selectedStatsIds.map(id=>habits.find(h=>h.id===id)).filter(Boolean),range=getStatsDays();
  $('#statsCount').textContent=`${selected.length}/3`;
  $('#statsHabitList').innerHTML=habits.length?habits.map(h=>{const checked=selectedStatsIds.includes(h.id),disabled=!checked&&selectedStatsIds.length>=3;return `<div class="stat-choice" style="--choice:${h.color}"><input type="checkbox" data-stat-id="${h.id}" ${checked?'checked':''} ${disabled?'disabled':''}><i></i><span>${escapeHtml(h.name)}</span><select data-stat-chart="${h.id}" aria-label="Вид графика для ${escapeHtml(h.name)}"><option value="line" ${h.chartType==='line'?'selected':''}>Линия</option><option value="bars" ${h.chartType==='bars'?'selected':''}>Столбики</option><option value="area" ${h.chartType==='area'?'selected':''}>Область</option></select></div>`}).join(''):'<div class="stat-choice">Сначала добавьте привычку</div>';
  $('#weekRange').textContent=formatWeekRange(range);$('#nextWeek').disabled=weekOffset===0;
  $('#chartLegend').innerHTML=selected.map(h=>`<span class="legend-item ${h.chartType}" style="--series:${h.color}"><i></i>${escapeHtml(h.name)}</span>`).join('');
  $('#chartWrap').hidden=selected.length===0;$('#chartEmpty').hidden=selected.length>0;
  if(!selected.length){$('#weeklyChart').innerHTML='';return}
  const left=62,top=25,width=700,height=230,bottom=top+height;
  const grid=[0,25,50,75,100].map(v=>{const y=top+(100-v)/100*height;return `<line class="chart-grid" x1="${left}" y1="${y}" x2="${left+width}" y2="${y}"/><text class="chart-axis-label" x="${left-12}" y="${y+4}" text-anchor="end">${v}%</text>`}).join('');
  const dayLabels=range.map((d,i)=>{const x=left+i*width/6;return `<text class="chart-axis-label" x="${x}" y="${bottom+28}" text-anchor="middle"><tspan x="${x}">${labels[d.getDay()]}</tspan><tspan x="${x}" dy="15">${d.getDate()}</tspan></text>`}).join('');
  const series=selected.map((h,seriesIndex)=>{const values=range.map(d=>valueFor(h,dayKey(d))),coords=values.map((v,i)=>({x:left+i*width/6,y:top+(100-v)/100*height,v})),points=coords.map(p=>`${p.x},${p.y}`).join(' ');if(h.chartType==='bars'){const barWidth=Math.min(22,54/selected.length),shift=(seriesIndex-(selected.length-1)/2)*(barWidth+3);return coords.map(p=>`<rect class="chart-bar" x="${p.x+shift-barWidth/2}" y="${p.y}" width="${barWidth}" height="${bottom-p.y}" rx="5" fill="${h.color}"><title>${escapeHtml(h.name)}: ${Math.round(p.v)}%</title></rect>`).join('')}const dots=coords.map(p=>`<circle class="chart-point" cx="${p.x}" cy="${p.y}" r="6" fill="${h.color}"><title>${escapeHtml(h.name)}: ${Math.round(p.v)}%</title></circle>`).join('');if(h.chartType==='area')return `<path class="chart-area" d="M${coords[0].x},${bottom} L${points.replaceAll(' ',' L')} L${coords[6].x},${bottom} Z" fill="${h.color}"/><polyline class="chart-line" points="${points}" stroke="${h.color}"/>${dots}`;return `<polyline class="chart-line" points="${points}" stroke="${h.color}"/>${dots}`}).join('');
  $('#weeklyChart').innerHTML=`${grid}${dayLabels}${series}`;
}
function selectColor(color){selectedColor=color;document.querySelectorAll('.color').forEach(x=>x.classList.toggle('selected',x.dataset.color===color))}
function selectType(type){selectedType=type;document.querySelectorAll('.type-option').forEach(x=>x.classList.toggle('selected',x.dataset.type===type));$('#goalField').hidden=type!=='quantity'}
function openModal(id=null){
  editingId=id;const habit=id?habits.find(h=>h.id===id):null;
  $('#modalTitle').textContent=habit?'Редактировать':'Новая привычка';
  $('#habitName').value=habit?.name||'';$('#includeSummary').checked=habit?.includeInSummary!==false;selectColor(habit?.color||colors[1][0]);selectedGoal=habit?.goal||1;$('#habitGoal').value=selectedGoal;selectType(habit?.type||'binary');
  $('#saveHabit').disabled=!$('#habitName').value.trim();$('#modal').hidden=false;document.body.style.overflow='hidden';setTimeout(()=>$('#habitName').focus(),30);
}
function closeModal(){editingId=null;$('#modal').hidden=true;document.body.style.overflow='';$('#habitName').value='';$('#includeSummary').checked=true;$('#saveHabit').disabled=true}
$('#colorPicker').innerHTML=colors.map(([c,name])=>`<button class="color" style="--c:${c}" data-color="${c}" aria-label="${name}" title="${name}"></button>`).join('');
selectColor(selectedColor);
$('#openModal').onclick=$('#emptyAdd').onclick=()=>openModal();$('#closeModal').onclick=closeModal;
$('#habitName').oninput=e=>$('#saveHabit').disabled=!e.target.value.trim();
$('#colorPicker').onclick=e=>{const b=e.target.closest('[data-color]');if(b)selectColor(b.dataset.color)};
$('#typePicker').onclick=e=>{const b=e.target.closest('[data-type]');if(b)selectType(b.dataset.type)};
$('#habitGoal').oninput=e=>selectedGoal=Math.max(1,Math.round(Number(e.target.value)||1));
$('#habitGoal').onchange=e=>{selectedGoal=Math.max(1,Math.round(Number(e.target.value)||1));e.target.value=selectedGoal};
function convertValue(raw,oldType,newType,oldGoal,newGoal){let pct=oldType==='binary'?(raw?100:0):oldType==='quantity'?Math.min(100,(Number(raw)||0)/(oldGoal||1)*100):Math.min(100,Number(raw)||0);if(newType==='binary')return pct>=100;if(newType==='quantity')return Number((pct/100*newGoal).toFixed(2));return Math.round(pct)}
$('#saveHabit').onclick=()=>{const name=$('#habitName').value.trim(),includeInSummary=$('#includeSummary').checked;if(!name)return;selectedGoal=Math.max(1,Math.round(Number($('#habitGoal').value)||1));if(editingId){const h=habits.find(x=>x.id===editingId);if(h.type!==selectedType){Object.keys(h.history).forEach(k=>h.history[k]=convertValue(h.history[k],h.type,selectedType,h.goal,selectedGoal))}h.name=name;h.color=selectedColor;h.type=selectedType;h.goal=selectedGoal;h.includeInSummary=includeInSummary}else{habits.unshift({id:crypto.randomUUID(),name,group:'',color:selectedColor,type:selectedType,chartType:'line',goal:selectedGoal,includeInSummary,createdAt:dayKey(today),history:{[dayKey(today)]:selectedType==='binary'?false:0}})}save();closeModal();render()};
function setPercentChoice(value){$('#percentRange').value=value;$('#percentValue').textContent=`${value}%`}
function openPercent(habit,key){percentTarget={id:habit.id,key};$('#percentModal').style.setProperty('--accent',habit.color);$('#percentTitle').textContent=habit.name;$('#percentDate').textContent=new Date(`${key}T12:00:00`).toLocaleDateString('ru',{weekday:'long',day:'numeric',month:'long'});setPercentChoice(valueFor(habit,key));$('#percentModal').hidden=false}
function closePercent(){percentTarget=null;$('#percentModal').hidden=true}
$('#percentRange').oninput=e=>setPercentChoice(Number(e.target.value));
$('#cancelPercent').onclick=closePercent;
$('#savePercent').onclick=()=>{if(!percentTarget)return;const h=habits.find(x=>x.id===percentTarget.id);h.history[percentTarget.key]=Number($('#percentRange').value);save();closePercent();render()};
$('#percentModal').onclick=e=>{if(e.target===$('#percentModal'))closePercent()};
function updateQuantityPreview(){if(!quantityTarget)return;const h=habits.find(x=>x.id===quantityTarget.id),actual=Math.max(0,Number($('#quantityValue').value)||0),pct=Math.min(100,actual/h.goal*100);$('#quantitySelected').textContent=actual;$('#quantityPercent').textContent=`${Math.round(pct)}% от цели`}
function openQuantity(habit,key){quantityTarget={id:habit.id,key};const max=Math.max(1,Math.round(habit.goal));$('#quantityModal').style.setProperty('--accent',habit.color);$('#quantityTitle').textContent=habit.name;$('#quantityDate').textContent=new Date(`${key}T12:00:00`).toLocaleDateString('ru',{weekday:'long',day:'numeric',month:'long'});$('#quantityGoalLabel').textContent=`из ${max}`;$('#quantityValue').max=max;$('#quantityValue').value=Math.min(max,Math.round(Number(habit.history[key])||0));updateQuantityPreview();$('#quantityModal').hidden=false;setTimeout(()=>$('#quantityValue').focus(),30)}
function closeQuantity(){quantityTarget=null;$('#quantityModal').hidden=true}
$('#quantityValue').oninput=updateQuantityPreview;$('#cancelQuantity').onclick=closeQuantity;
$('#saveQuantity').onclick=()=>{if(!quantityTarget)return;const h=habits.find(x=>x.id===quantityTarget.id);h.history[quantityTarget.key]=Math.max(0,Number($('#quantityValue').value)||0);save();closeQuantity();render()};
$('#quantityModal').onclick=e=>{if(e.target===$('#quantityModal'))closeQuantity()};
$('#previousWeek').onclick=()=>{weekOffset--;renderStats()};
$('#nextWeek').onclick=()=>{if(weekOffset<0){weekOffset++;renderStats()}};
$('#statsHabitList').onchange=e=>{const chart=e.target.closest('[data-stat-chart]');if(chart){const h=habits.find(x=>x.id===chart.dataset.statChart);if(h){h.chartType=chart.value;save();renderStats()}return}const box=e.target.closest('[data-stat-id]');if(!box)return;const id=box.dataset.statId;if(box.checked&&selectedStatsIds.length<3)selectedStatsIds.push(id);if(!box.checked)selectedStatsIds=selectedStatsIds.filter(x=>x!==id);renderStats()};
function openGroupModal(name=null){editingGroupName=name;$('#groupModalTitle').textContent=name?'Редактировать группу':'Новая группа';$('#groupName').value=name||'';$('#deleteGroup').hidden=!name;$('#saveGroup').disabled=!name;$('#groupModal').hidden=false;setTimeout(()=>$('#groupName').focus(),30)}
function closeGroupModal(){editingGroupName=null;$('#groupModal').hidden=true;$('#groupName').value=''}
$('#addGroup').onclick=()=>openGroupModal();$('#cancelGroup').onclick=closeGroupModal;
$('#groupName').oninput=e=>$('#saveGroup').disabled=!e.target.value.trim();
$('#saveGroup').onclick=()=>{const name=$('#groupName').value.trim();if(!name||name==='Без группы')return;if(editingGroupName){habits.forEach(h=>{if(h.group===editingGroupName)h.group=name});groupNames=groupNames.map(g=>g===editingGroupName?name:g);if(collapsedGroups.delete(editingGroupName))collapsedGroups.add(name)}else if(!groupNames.includes(name))groupNames.push(name);groupNames=[...new Set(groupNames)];save();saveGroups();saveGroupNames();closeGroupModal();render()};
$('#deleteGroup').onclick=()=>{if(!editingGroupName)return;habits.forEach(h=>{if(h.group===editingGroupName)h.group=''});groupNames=groupNames.filter(g=>g!==editingGroupName);collapsedGroups.delete(editingGroupName);save();saveGroups();saveGroupNames();closeGroupModal();render()};
$('#groupModal').onclick=e=>{if(e.target===$('#groupModal'))closeGroupModal()};
$('#habitList').onclick=e=>{const groupEdit=e.target.closest('[data-group-edit]');if(groupEdit){openGroupModal(groupEdit.dataset.groupEdit);return}const group=e.target.closest('[data-group-toggle]');if(group){const name=group.dataset.groupToggle;collapsedGroups.has(name)?collapsedGroups.delete(name):collapsedGroups.add(name);saveGroups();render();return}const edit=e.target.closest('[data-edit]');if(edit){openModal(edit.dataset.edit);return}const del=e.target.closest('[data-delete]');if(del){pendingDeleteId=del.dataset.delete;$('#deleteConfirm').hidden=false;return}const b=e.target.closest('[data-id],[data-toggle]');if(!b)return;const id=b.dataset.id||b.dataset.toggle;const h=habits.find(x=>x.id===id);const key=b.dataset.day||dayKey(days[0]);if(h.type==='percent'){openPercent(h,key);return}if(h.type==='quantity'){openQuantity(h,key);return}h.history[key]=!h.history[key];save();render()};
$('#habitList').ondragstart=e=>{const row=e.target.closest('[data-habit-drag]');if(!row)return;draggedHabitId=row.dataset.habitDrag;row.classList.add('dragging');$('#habitList').classList.add('drag-active');e.dataTransfer.effectAllowed='move'};
$('#habitList').ondragend=e=>{e.target.closest('[data-habit-drag]')?.classList.remove('dragging');document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));$('#habitList').classList.remove('drag-active');draggedHabitId=null};
$('#habitList').ondragover=e=>{const target=e.target.closest('[data-drop-group]');if(!target||!draggedHabitId)return;e.preventDefault();document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));target.classList.add('drag-over')};
$('#habitList').ondrop=e=>{const target=e.target.closest('[data-drop-group]');if(!target||!draggedHabitId)return;e.preventDefault();const h=habits.find(x=>x.id===draggedHabitId);if(h){h.group=target.dataset.dropGroup||'';save();render()}$('#habitList').classList.remove('drag-active');draggedHabitId=null};
function closeDeleteConfirm(){pendingDeleteId=null;$('#deleteConfirm').hidden=true}
$('#cancelDelete').onclick=closeDeleteConfirm;
$('#confirmDelete').onclick=()=>{if(!pendingDeleteId)return;habits=habits.filter(h=>h.id!==pendingDeleteId);save();closeDeleteConfirm();render()};
$('#deleteConfirm').onclick=e=>{if(e.target===$('#deleteConfirm'))closeDeleteConfirm()};
$('#modal').onclick=e=>{if(e.target===$('#modal'))closeModal()};document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!$('#quantityModal').hidden)closeQuantity();else if(!$('#percentModal').hidden)closePercent();else if(!$('#deleteConfirm').hidden)closeDeleteConfirm();else if(!$('#modal').hidden)closeModal()});save();render();
