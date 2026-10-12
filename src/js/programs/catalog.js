(() => {
 'use strict';
 const storage = {
  read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be unavailable in private mode. */ } }
 };
 const catalog = document.querySelector('[data-catalog]');
 if (catalog) {
  const programs = JSON.parse(document.getElementById('programs-data').textContent);
  const form = document.getElementById('program-filters');
  const search = document.getElementById('program-search');
  const clear = form.querySelector('[data-clear-search]');
  const reset = form.querySelector('[type=reset]');
  const sort = catalog.querySelector('[data-sort]');
  const cards = new Map([...catalog.querySelectorAll('[data-program]')].map(card => [Number(card.dataset.program), card]));
  const cardList = catalog.querySelector('.catalog__cards');
  const pagination = catalog.querySelector('.pagination');
  const pages = pagination.querySelector('[data-pages]');
  const previous = pagination.querySelector('[data-page-previous]');
  const next = pagination.querySelector('[data-page-next]');
  const saved = new Set(storage.read('safu-saved-programs', []));
  const mobile = matchMedia('(max-width:460px)');
  let page = 1, totalPages = 1;
  const normalize = text => String(text).toLocaleLowerCase('ru').replaceAll('ё', 'е');
  search.value = new URLSearchParams(location.search).get('q') || '';
  function render() {
   const query = normalize(search.value.trim());
   const selected = new Map();
   form.querySelectorAll('input[type=checkbox]:checked').forEach(input => {
    const key = input.name.replace('[]', '');
    selected.set(key, [...(selected.get(key) || []), input.value]);
   });
   let filtered = programs.filter(program => {
    if (query && !normalize(program.title + ' ' + program.direction + ' ' + program.area + ' ' + program.level).includes(query)) return false;
    return [...selected].every(([key, values]) => values.some(value => Array.isArray(program[key]) ? program[key].includes(value) : program[key] === value));
   });
   if (sort.value === 'name') filtered.sort((a,b) => a.title.localeCompare(b.title, 'ru') || a.id-b.id);
   if (sort.value === 'price') filtered.sort((a,b) => a.cost-b.cost || a.id-b.id);
   if (sort.value === 'saved') filtered = filtered.filter(program => saved.has(program.id));
   const perPage = mobile.matches ? 3 : 5;
   totalPages = Math.ceil(filtered.length / perPage);
   page = Math.min(page, Math.max(1, totalPages));
   cards.forEach(card => { card.hidden = true; });
   filtered.slice((page-1)*perPage, page*perPage).forEach(program => { const card=cards.get(program.id); card.hidden=false; cardList.append(card); });
   const count=filtered.length, last=count%10, lastTwo=count%100;
   const noun=last===1&&lastTwo!==11?'программа':last>=2&&last<=4&&(lastTwo<12||lastTwo>14)?'программы':'программ';
   catalog.querySelector('[data-results-count]').textContent = 'Найдено: ' + count + ' ' + noun;
   catalog.querySelector('.catalog__empty').hidden = filtered.length > 0;
   reset.disabled = !query && selected.size === 0;
   clear.hidden = search.value.length === 0;
   form.querySelectorAll('.filters__group').forEach(group => {
    const count=group.querySelectorAll('input:checked').length;
    group.querySelector('[data-filter-count]').textContent=count ? '('+count+')' : '';
   });
   pagination.hidden = totalPages < 2;
   previous.disabled = page === 1;
   next.disabled = page >= totalPages;
   pages.replaceChildren();
   // Four consecutive numbers keep pagination within a 320px viewport.
   const start = Math.max(1, Math.min(page-1,totalPages-3));
   for(let number=start; number<=Math.min(totalPages,start+3); number++) {
    const button=document.createElement('button');
    button.type='button'; button.className='pagination__button'; button.textContent=String(number).padStart(2,'0');
    button.dataset.page=String(number); button.setAttribute('aria-label','Страница '+number);
    if(number===page) button.setAttribute('aria-current','page');
    pages.append(button);
   }
  }
  const changePage = number => {
   page=number; render();
   catalog.querySelector('[data-page="'+page+'"]')?.focus({preventScroll:true});
   catalog.querySelector('.catalog__results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
  };
  pagination.addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button)changePage(Number(button.dataset.page));});
  previous.addEventListener('click',()=>changePage(Math.max(1,page-1)));
  next.addEventListener('click',()=>changePage(Math.min(totalPages,page+1)));
  form.addEventListener('submit',event=>event.preventDefault());
  form.addEventListener('input',()=>{page=1;render();});
  form.addEventListener('reset',event=>{
   event.preventDefault();
   search.value='';
   form.querySelectorAll('input[type=checkbox]').forEach(input=>{input.checked=false;});
   page=1;render();
  });
  clear.addEventListener('click',()=>{search.value='';page=1;render();search.focus();});
  sort.addEventListener('change',()=>{page=1;render();});
  mobile.addEventListener('change',()=>{page=1;render();});
  catalog.querySelectorAll('[data-save]').forEach(button=>{
   const id=Number(button.dataset.save);
   const update=()=>{const on=saved.has(id);button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',on?'Удалить программу из избранного':'Добавить программу в избранное');};
   update();
   button.addEventListener('click',()=>{saved.has(id)?saved.delete(id):saved.add(id);storage.write('safu-saved-programs',[...saved]);update();if(sort.value==='saved')render();});
  });
  render();
 }
})();
