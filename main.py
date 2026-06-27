import asyncio
import html
import logging
import os
from datetime import datetime

from aiohttp import web
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart, Command
from aiogram.types import Message
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup
from aiogram.filters.callback_data import CallbackData
from aiogram.utils.keyboard import InlineKeyboardBuilder
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN      = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID  = os.getenv("ADMIN_CHAT_ID")
WEB_HOST       = os.getenv("WEB_HOST", "0.0.0.0")
WEB_PORT       = int(os.getenv("WEB_PORT", "8080"))
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "*")

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN .env faylda topilmadi")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uzbek-taxi-bot")

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()


class OrderDB(CallbackData, prefix="order"):
    action: str # "confirm" | "reject"


def oreder_keyboard() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="✅ Tasdiqlash", callback_data=OrderDB(action="confirm"))
    kb.button(text="❌ Rad etish", callback_data=OrderDB(action="reject"))
    kb.adjust(2)
    return kb.as_markup()


# ---------- Bot buyruqlari ----------
@dp.message(CommandStart())
async def cmd_start(message: Message):
    await message.answer(
        "Salom! O'zbek Taxi buyurtmalarini qabul qiluvchi bot.\n"
        f"Ushbu chat ID: <code>{message.chat.id}</code>\n\n"
        "Shu ID'ni <b>.env</b> faylga <code>ADMIN_CHAT_ID</code> qilib qo'ying."
    )


@dp.message(Command("id"))
async def cmd_id(message: Message):
    await message.answer(f"Chat ID: <code>{message.chat.id}</code>")


# ---------- Web endpoint ----------
async def handle_order(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "invalid_json"}, status=400)

    from_ = str(data.get("from", "")).strip()
    to    = str(data.get("to", "")).strip()
    phone = str(data.get("phone", "")).strip()

    if not from_ or not to or not phone:
        return web.json_response({"ok": False, "error": "missing_fields"}, status=422)

    if not ADMIN_CHAT_ID:
        return web.json_response({"ok": False, "error": "admin_not_set"}, status=503)

    text = (
        "🚕 <b>Yangi buyurtma!</b>\n\n"
        f"📍 <b>Qayerdan:</b> {html.escape(from_)}\n"
        f"🏁 <b>Qayerga:</b> {html.escape(to)}\n"
        f"📞 <b>Telefon:</b> {html.escape(phone)}\n"
        f"🕒 <b>Vaqt:</b> {datetime.now():%Y-%m-%d %H:%M}"
    )

    try:
        await bot.send_message(ADMIN_CHAT_ID, text, reply_markup=oreder_keyboard())
    except Exception as e:
        logger.exception("send_message xato: %s", e)
        return web.json_response({"ok": False, "error": "send_failed"}, status=502)

    return web.json_response({"ok": True})


@dp.callback_query(OrderDB.filter())
async def on_order_decision(callback: CallbackQuery, callback_data: OrderDB):
    decided_by = html.escape(callback.from_user.full_name)
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    if callback_data.action == "confirm":
        status_line = f"\n\n✅ <b>Tasdiqlandi</b> — {decided_by} ({now})"
        toast = "Buyurtma tasdiqlandi ✅"
    else:
        status_line = f"\n\n❌ <b>Bekor qilindi</b> — {decided_by} ({now})"
        toast = "Buyurtma bekor qilindi ❌"

    new_text = callback.message.html_text + status_line

    try:
        # Matnni yangilaymiz va tugmalarni olib tashlaymiz
        await callback.message.edit_text(new_text, reply_markup=None)
    except Exception as e:
        logger.exception("edit_text xato: %s", e)

    await callback.answer(toast)


# ---------- CORS (dev uchun) ----------
@web.middleware
async def cors_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        resp = web.Response(status=204)
    else:
        try:
            resp = await handler(request)
        except web.HTTPException as exc:
            exc.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
            raise
    resp.headers["Access-Control-Allow-Origin"]  = ALLOWED_ORIGIN
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


async def main():
    if not ADMIN_CHAT_ID:
        logger.warning("ADMIN_CHAT_ID bo'sh — botga /start yuborib ID oling, .env'ga yozing.")

    app = web.Application(middlewares=[cors_middleware])
    app.router.add_post("/api/order", handle_order)
    app.router.add_get("/health", lambda r: web.json_response({"ok": True}))
    app.router.add_get("/", lambda r: web.json_response({"ok": True, "message": "Uzbek Taxi Bot"}))

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host=WEB_HOST, port=WEB_PORT)
    await site.start()
    logger.info("🌐 HTTP server: http://%s:%s", WEB_HOST, WEB_PORT)

    await bot.delete_webhook(drop_pending_updates=True)
    logger.info("🤖 Bot polling boshlandi")
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("To'xtatildi")