export function setupUI() {
  const dialogs = [...document.querySelectorAll('dialog')];
  const brief = document.querySelector('#brief-dialog');
  const projectDialog = document.querySelector('#project-dialog');
  const open = dialog => { dialog.showModal(); document.body.classList.add('modal-open'); };
  document.querySelectorAll('[data-contact]').forEach(button => button.addEventListener('click', () => open(brief)));
  for (const dialog of dialogs) {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { if (!dialogs.some(d => d.open)) document.body.classList.remove('modal-open'); });
    let beganOutside = false;
    dialog.addEventListener('pointerdown', event => { beganOutside = event.target === dialog && outside(event, dialog); });
    dialog.addEventListener('click', event => { if (beganOutside && event.target === dialog && outside(event, dialog)) dialog.close(); beganOutside = false; });
  }
  function outside(event, dialog) { const r = dialog.getBoundingClientRect(); return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom; }
  const projects = {
    strategy: { title: 'Сначала — смысл.', category: '01 / STRATEGY & IDENTITY', description: 'Исследуем контекст, аудиторию и задачу. Формулируем позиционирование, находим характер и создаём визуальную систему: от знака и типографики до языка коммуникации.', tags: ['Исследование', 'Позиционирование', 'Айдентика', 'Арт-дирекшн'] },
    digital: { title: 'Digital с характером.', category: '02 / DIGITAL EXPERIENCE', description: 'Проектируем пользовательский опыт и выразительный интерфейс. Соединяем понятную структуру с сильной визуальной идеей. Продумываем все состояния и адаптацию к разным устройствам.', tags: ['UX / UI', 'Сайты', 'Интерфейсы', 'Дизайн-системы'] },
    motion: { title: 'Код как ощущение.', category: '03 / CREATIVE DEVELOPMENT', description: 'Создаём интерактивные сцены, объёмные миры и анимацию, управляемую пользователем. Используем движение, свет и глубину, чтобы рассказать историю и передать характер проекта.', tags: ['WebGL / 3D', 'Motion', 'Frontend', 'Интерактив'] }
  };
  document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => {
    const p = projects[button.dataset.project];
    document.querySelector('#project-title').textContent = p.title;
    document.querySelector('#project-category').textContent = p.category;
    document.querySelector('#project-description').textContent = p.description;
    document.querySelector('#project-tags').replaceChildren(...p.tags.map(text => { const e = document.createElement('span'); e.textContent = text; return e; }));
    open(projectDialog);
  }));
  document.querySelector('#similar-project').addEventListener('click', () => { projectDialog.close(); open(brief); });
  document.querySelector('#brief-form').addEventListener('submit', event => {
    event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    const content = `AETHER — БРИФ ПРОЕКТА\n\nИмя: ${data.get('name').trim()}\nEmail: ${data.get('email').trim()}\nНаправления: ${data.getAll('service').join(', ') || 'Обсудим'}\n\nИдея:\n${data.get('idea').trim()}\n\nСоздан локально. Данные не отправлялись на сервер.\n`;
    const url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'aether-project-brief.txt';
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    document.querySelector('#form-status').textContent = 'Бриф подготовлен. Сохраните файл и передайте его своей команде.';
  });
}
