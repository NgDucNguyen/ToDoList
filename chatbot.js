(function () {
  'use strict';
  window.PlannerChatbot = {
    init({ getContext, getTaskList, getNotes, applyProposal }) {
      const $ = id => document.getElementById(id);
      const session = PlannerLocalChatbot.createSession({ getContext, getTaskList, getNotes });
      let busy = false;
      const status = (message, error = false) => { $('cb-status').textContent = message; $('cb-status').classList.toggle('error', error); };
      function scrollToEnd() { $('cb-messages').scrollTop = $('cb-messages').scrollHeight; }
      function addMessage(role, text) {
        const element = document.createElement('div'); element.className = `cb-message ${role}`; element.textContent = text;
        $('cb-messages').append(element); scrollToEnd();
      }
      function welcome() {
        addMessage('assistant', 'Chào bạn! Bạn cứ hỏi, mình sẽ tự tìm trong lịch và ghi chú đã lưu.\nVí dụ: “Mai học môn gì?”, “Tìm lịch họp”, “Tóm tắt toàn bộ lịch”. Không cần chọn ngày hay kết nối mạng.');
        const choices = document.createElement('div'); choices.className = 'cb-suggestions';
        for (const [label, question] of [['Lịch hôm nay', 'Hôm nay có lịch gì?'], ['Tóm tắt tuần', 'Tóm tắt lịch tuần này'], ['Việc quá hạn', 'Việc nào quá hạn?'], ['Ghi chú nhanh', 'Ghi chú: ']]) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
          button.addEventListener('click', () => { $('cb-input').value = question; $('cb-input').focus(); }); choices.append(button);
        }
        $('cb-messages').append(choices);
      }
      function setOpen(open) {
        $('cb-panel').hidden = !open; $('cb-launcher').setAttribute('aria-expanded', String(open));
        if (open) $('cb-input').focus(); else $('cb-launcher').focus();
      }
      $('cb-launcher').addEventListener('click', () => setOpen($('cb-panel').hidden));
      $('cb-close').addEventListener('click', () => setOpen(false));
      $('cb-panel').addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } });
      $('cb-new-chat').addEventListener('click', () => {
        if (busy) return;
        session.reset(); $('cb-messages').replaceChildren(); $('cb-input').value = ''; status('Đã bắt đầu cuộc trò chuyện mới.'); welcome();
      });
      function showProposal(proposal) {
        const card = document.createElement('div'); card.className = 'cb-proposal';
        const preview = document.createElement('pre');
        preview.textContent = proposal.kind === 'create_task'
          ? `LỊCH CÁ NHÂN · Chờ xác nhận\n${proposal.title}\nNgày: ${proposal.date.split('-').reverse().join('/')}\nGiờ: ${proposal.time || 'Không đặt giờ'}${proposal.body ? '\n' + proposal.body : ''}`
          : `GHI CHÚ · Chờ xác nhận\n${proposal.title}\n\n${proposal.body}`;
        const actions = document.createElement('div'); actions.className = 'cb-proposal-actions';
        const accept = document.createElement('button'), dismiss = document.createElement('button');
        accept.type = dismiss.type = 'button'; accept.className = 'cb-accept'; dismiss.className = 'cb-dismiss';
        accept.textContent = 'Xác nhận tạo'; dismiss.textContent = 'Bỏ qua';
        let applied = false;
        accept.addEventListener('click', () => {
          if (applied) return;
          accept.disabled = true;
          try {
            const message = applyProposal(proposal);
            applied = true; accept.textContent = 'Đã tạo'; dismiss.disabled = true; status(''); addMessage('assistant', message);
          } catch (error) { status(error.message, true); accept.disabled = false; }
        });
        dismiss.addEventListener('click', () => { applied = true; accept.disabled = dismiss.disabled = true; accept.textContent = 'Đã bỏ qua'; });
        actions.append(accept, dismiss); card.append(preview, actions); $('cb-messages').append(card); scrollToEnd();
      }
      $('cb-form').addEventListener('submit', async event => {
        event.preventDefault();
        if (busy) return;
        const question = $('cb-input').value; if (!question.trim()) return;
        busy = true; $('cb-send').disabled = $('cb-new-chat').disabled = true; status('Đang xử lý trên máy…');
        addMessage('user', question); $('cb-input').value = '';
        try {
          await new Promise(resolve => setTimeout(resolve, 0));
          const result = PlannerChatbotCore.validateResult(session.respond(question), PlannerStore);
          addMessage('assistant', result.reply);
          if (result.kind !== 'none') showProposal(result);
          status('');
        } catch (error) { status(error.message, true); if (!$('cb-input').value) $('cb-input').value = question; }
        finally { busy = false; $('cb-send').disabled = $('cb-new-chat').disabled = false; }
      });
      $('cb-input').addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('cb-form').requestSubmit(); }
      });
      welcome();
    },
  };
})();
