import dotenv from 'dotenv';
import { validateConfig } from './config';
import { startBot } from './bot';

// 環境變數
dotenv.config();
validateConfig();

// 啟動 Discord Bot
startBot();
