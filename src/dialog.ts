let dialog: HTMLDialogElement | undefined;

export function showDetails(title: string, content: string, options: { wide?: boolean } = {}): HTMLDialogElement {
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'data-dialog';
    dialog.setAttribute('aria-labelledby', 'data-dialog-title');
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog!.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog!.close();
    });
  }
  dialog.classList.toggle('wide-dialog', options.wide ?? false);
  dialog.innerHTML = `<div class="dialog-head"><h2 id="data-dialog-title"></h2><button type="button" aria-label="상세 정보 닫기">✕</button></div><div class="dialog-body">${content}</div>`;
  dialog.querySelector('h2')!.textContent = title;
  dialog.querySelector('button')!.addEventListener('click', () => dialog!.close());
  dialog.showModal();
  return dialog;
}
