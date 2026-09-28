/* 微模块：自绘确认弹窗（inftab IConfirm 对齐）+ Toast（零业务依赖） */
import { $ } from '../common.js?v=20260930h';
import { t } from '../i18n.js?v=20260930h';

/* ================= 自绘确认弹窗（inftab IConfirm 对齐） ================= */
let cfResolve = null;
function uiConfirm(title, text) {
  return new Promise(resolve => {
    const dlg = $('#dlgConfirm');
    $('#cfTitle').textContent = title || t('确定');
    $('#cfText').textContent = text || '';
    cfResolve = resolve;
    dlg.showModal();
  });
}

/* ================= Toast ================= */
function toast(msg, type = 'info', ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 350);
  }, ms);
}

export { uiConfirm, toast };
