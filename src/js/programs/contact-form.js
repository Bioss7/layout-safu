(() => {
 'use strict';
 const contactForm=document.querySelector('[data-contact-form]');
 if(contactForm) {
  const fields=[...contactForm.querySelectorAll('input,select,textarea')];
  const topic=contactForm.querySelector('[data-topic]');
  const topicInput=topic.querySelector('[name=topic]');
  const topicTrigger=topic.querySelector('[role=combobox]');
  const topicList=topic.querySelector('[role=listbox]');
  const topicOptions=[...topicList.querySelectorAll('[role=option]')];
  let activeTopic=-1, typeAhead='', typeAheadTimer;
  const highlightTopic=index=>{
   activeTopic=index;
   topicOptions.forEach((option,i)=>option.classList.toggle('is-active',i===index));
   if(index>=0) {
    topicTrigger.setAttribute('aria-activedescendant',topicOptions[index].id);
    topicOptions[index].scrollIntoView({block:'nearest'});
   } else topicTrigger.removeAttribute('aria-activedescendant');
  };
  const closeTopic=()=>{
   topicList.hidden=true;
   topicTrigger.setAttribute('aria-expanded','false');
   topicTrigger.removeAttribute('aria-activedescendant');
  };
  const openTopic=()=>{
   topicList.hidden=false;
   topicTrigger.setAttribute('aria-expanded','true');
   const selected=topicOptions.findIndex(option=>option.dataset.value===topicInput.value);
   highlightTopic(selected<0?0:selected);
  };
  const selectTopic=index=>{
   if(index<0)return;
   const option=topicOptions[index];
   topicInput.value=option.dataset.value;
   topicTrigger.querySelector('[data-topic-label]').textContent=option.textContent;
   topicTrigger.classList.add('is-filled');
   topicOptions.forEach(item=>item.setAttribute('aria-selected',String(item===option)));
   closeTopic();
   validate(topicInput);
   topicTrigger.focus({preventScroll:true});
  };
  topicTrigger.addEventListener('click',()=>topicList.hidden?openTopic():closeTopic());
  topicList.addEventListener('click',event=>{const option=event.target.closest('[role=option]');if(option)selectTopic(topicOptions.indexOf(option));});
  topicTrigger.addEventListener('keydown',event=>{
   const open=!topicList.hidden;
   if(event.key==='Tab'){closeTopic();return;}
   if(event.key==='Escape'){closeTopic();event.preventDefault();return;}
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
    event.preventDefault();
    if(!open)openTopic();
    if(event.key==='Home')highlightTopic(0);
    else if(event.key==='End')highlightTopic(topicOptions.length-1);
    else if(open)highlightTopic((activeTopic+(event.key==='ArrowDown'?1:-1)+topicOptions.length)%topicOptions.length);
    else if(event.key==='ArrowUp')highlightTopic(topicOptions.length-1);
    return;
   }
   if(event.key==='Enter'||event.key===' ') {
    event.preventDefault();
    open?selectTopic(activeTopic):openTopic();
    return;
   }
   if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey) {
    event.preventDefault();clearTimeout(typeAheadTimer);
    typeAhead+=event.key.toLocaleLowerCase('ru');
    if(!open)openTopic();
    const index=topicOptions.findIndex(option=>option.textContent.trim().toLocaleLowerCase('ru').startsWith(typeAhead));
    if(index>=0)highlightTopic(index);
    typeAheadTimer=setTimeout(()=>{typeAhead='';},700);
   }
  });
  document.addEventListener('click',event=>{if(!topic.contains(event.target))closeTopic();});
  topicTrigger.addEventListener('blur',()=>{closeTopic();validate(topicInput);});
  // Keep focus on the combobox until the option click is handled.
  topicList.addEventListener('mousedown',event=>event.preventDefault());
  function validate(field) {
   let error='';
   if((field.required||field.hasAttribute('data-required')) && (field.type==='checkbox'?!field.checked:!field.value.trim())) error=field.type==='checkbox'?'Необходимо согласие на обработку данных.':'Заполните это поле.';
   else if(field.type==='email' && field.validity.typeMismatch) error='Укажите корректный адрес электронной почты.';
   else if(field.name==='phone' && field.value.replace(/\D/g,'').length<10) error='Укажите номер телефона с кодом города или оператора.';
   field.setAttribute('aria-invalid',String(Boolean(error)));
   if(field===topicInput)topicTrigger.setAttribute('aria-invalid',String(Boolean(error)));
   const message=document.getElementById('error-'+field.name);if(message)message.textContent=error;
   return !error;
  }
  fields.forEach(field=>{field.addEventListener('blur',()=>validate(field));field.addEventListener('input',()=>{if(field.getAttribute('aria-invalid')==='true')validate(field);});});
  contactForm.addEventListener('submit',event=>{
   event.preventDefault();
   const invalid=fields.filter(field=>!validate(field));
   if(invalid.length){(invalid[0]===topicInput?topicTrigger:invalid[0]).focus();return;}
   // Layout stage: no endpoint is connected and personal data is not transmitted.
   const status=contactForm.querySelector('.contact-form__status');
   status.textContent='Форма пока не принимает заявки. Ваше сообщение не отправлено. Пожалуйста, напишите на fdp@narfu.ru.';
   status.hidden=false;
  });
 }
})();
