'use strict';
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const cfg = require(process.env.NATIONAL_DOWNLOADER_CONFIG || 'C:/Program Files (x86)/CMS Server/CeibaWebDownloader/rebuild/config.cjs');
// Reuse Nacional's existing configuration and session identity in memory only.
Object.assign(process.env, {
  NODE_ENV: 'production', MYSQL_HOST: String(cfg.cms.dbHost), MYSQL_PORT: String(cfg.cms.dbPort),
  MYSQL_USER: String(cfg.cms.dbUser), MYSQL_PASSWORD: String(cfg.cms.dbPassword), MYSQL_DATABASE: String(cfg.cms.dbName),
  JWT_SECRET: cfg.secret, DES_KEY: 'rogernet', DES_IV: 'rogernet',
  CEIBA_WEB_PORT: String(cfg.cms.port), CEIBA_WEB_API_JAVA_PORT: String(cfg.cms.ceiba2HttpApiJavaPort),
  CEIBA_FLV_PORT: String(cfg.cms.ceiba2FlvPort).split(' ')[0], CEIBA_GPS_HISTORY_PORT: String(cfg.cms.ceiba2WebApiPort),
  CEIBA_TRANSMIT_PORT: String(cfg.cms.ceiba2TransmitPort), CEIBA_ARMS_URL: 'http://127.0.0.1:' + cfg.cms.ceiba2WebApiPort
});
process.chdir(__dirname);
require('./dist/server.cjs');
