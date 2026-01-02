import dotenv from 'dotenv';
import { validateConfig } from './config';
import { startBot } from './bot';

// 載入環境變數
dotenv.config();

// 驗證配置
validateConfig();

// 啟動 Bot
startBot();
