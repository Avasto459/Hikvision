import { getContactMessageById, saveContactReply, StoreError } from "@/lib/db";
import { getEmailConfigurationError, sendEmailMessage } from "@/lib/email";

/**
 * Ответ админа на обращение: сначала сохраняем его в БД (replyText, repliedAt,
 * isReplied, status = ANSWERED) — именно его увидит автор на сайте. Копия на email
 * отправляется «по возможности»: сбой SMTP не отменяет уже сохранённый ответ.
 */
export async function replyToContactMessage(messageId: string, replyText: string) {
  const original = await getContactMessageById(messageId);
  if (!original) throw new StoreError("Сообщение не найдено.", 404);
  const saved = await saveContactReply(messageId, replyText);
  if (!saved) throw new StoreError("Не удалось сохранить ответ.", 500);

  let emailed = false;
  let note = "";
  if (!original.email) {
    note = "Email не указан — ответ сохранён и появится в чате на сайте.";
  } else if (getEmailConfigurationError()) {
    note = "SMTP не настроен — ответ сохранён на сайте, письмо не отправлено.";
  } else {
    try {
      await sendEmailMessage({
        to: original.email,
        subject: "Ответ на ваше сообщение — HASI.TJ",
        text: `Здравствуйте, ${original.name}!\n\n${saved.replyText}\n\n— Ваше сообщение —\n${original.message}\n\nHASI.TJ`,
      });
      emailed = true;
    } catch (error) {
      note = error instanceof Error ? error.message : "Не удалось отправить письмо.";
    }
  }
  return { reply: saved, emailed, note };
}
