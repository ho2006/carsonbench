import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, screen, session, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile, rename, rm } from 'node:fs/promises';
import { callDeepSeek } from '../server/deepseek.js';
import { APP_URL, bundledFile, externalUrl, trustedPage } from './security.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const smoke = process.argv.includes('--smoke-test');
const smokeRoot = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
app.setName('CarsonBench');
app.setPath('userData',smoke ? path.join(smokeRoot,'.desktop-test-profile') : path.join(app.getPath('appData'),'CarsonBench'));
protocol.registerSchemesAsPrivileged([{scheme:'carsonbench',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.setAppUserModelId('org.carsonbench.desktop');
const requests = new Map();
let mainWindow;

function trustedSender(event) {
  return mainWindow && event.sender === mainWindow.webContents && event.senderFrame === event.sender.mainFrame && trustedPage(event.senderFrame.url);
}

ipcMain.handle('deepseek:request',async (event,id,route,apiKey,input) => {
  if (!trustedSender(event) || typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(id) || !['models','chat'].includes(route)) return {status:403,error:'调用来源无效。'};
  if (requests.has(id) || requests.size >= 2) return {status:429,error:'已有调用正在处理，请稍后重试。'};
  if (route === 'chat' && (!input || typeof input !== 'object' || JSON.stringify(input).length > 350000)) return {status:400,error:'实验输入无效或过长。'};
  const controller = new AbortController(); requests.set(id,controller);
  try { return await callDeepSeek(apiKey,route === 'models' ? null : input,{signal:controller.signal}); }
  finally { requests.delete(id); }
});
ipcMain.on('deepseek:cancel',(event,id) => { if (trustedSender(event)) requests.get(id)?.abort(); });
ipcMain.handle('record:save',async (event,filename,content) => {
  if (!trustedSender(event) || typeof filename !== 'string' || !/^CarsonBench-[a-zA-Z0-9-]+\.json$/.test(filename) || typeof content !== 'string' || Buffer.byteLength(content) > 8*1024*1024) return {error:'记录格式无效或超过 8 MB。'};
  try { JSON.parse(content); } catch { return {error:'记录不是有效的 JSON。'}; }
  const result = await dialog.showSaveDialog(mainWindow,{title:'保存完整实验记录',defaultPath:path.join(app.getPath('downloads'),filename),filters:[{name:'CarsonBench 实验记录',extensions:['json']}],properties:['showOverwriteConfirmation','createDirectory']});
  if (result.canceled || !result.filePath) return {canceled:true};
  const temporary = `${result.filePath}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary,content,{encoding:'utf8',flag:'wx'});
    await rename(temporary,result.filePath);
    return {saved:true};
  } catch { await rm(temporary,{force:true}).catch(()=>{}); return {error:'文件无法保存，请选择有写入权限的位置；原记录已保留。'}; }
});

async function createWindow() {
  const area = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({width:Math.min(1380,area.width),height:Math.min(1000,area.height),minWidth:1080,minHeight:720,show:false,backgroundColor:'#F5F3EA',title:'CarsonBench · 人机阅读实验',icon:path.join(here,'../build/icon.png'),webPreferences:{preload:path.join(here,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:!smoke}});
  mainWindow.webContents.setWindowOpenHandler(({url}) => { if (externalUrl(url)) shell.openExternal(url); return {action:'deny'}; });
  mainWindow.webContents.on('will-navigate',(event,url) => { if (!trustedPage(url)) { event.preventDefault(); if (externalUrl(url)) shell.openExternal(url); } });
  mainWindow.webContents.on('will-attach-webview',event=>event.preventDefault());
  mainWindow.on('closed',()=>{for(const controller of requests.values())controller.abort();requests.clear();mainWindow=null;});
  await mainWindow.loadURL(APP_URL);
  if (smoke) {
    try { const { checkDesktop } = await import('./smoke.js'); await checkDesktop(mainWindow,smokeRoot); app.exit(0); }
    catch (error) { console.error(error); app.exit(1); }
  } else mainWindow.show();
}

if (!smoke && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus();}});
  app.whenReady().then(async () => {
    protocol.handle('carsonbench',async request => {
      try {
        if (request.method !== 'GET') return new Response('',{status:405});
        const response = await net.fetch(pathToFileURL(bundledFile(path.join(here,'../dist'),request.url)).toString());
        const headers = new Headers(response.headers);
        headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-src 'none'; form-action 'none'");
        return new Response(response.body,{status:response.status,headers});
      } catch { return new Response('Resource not found',{status:404}); }
    });
    session.defaultSession.setPermissionRequestHandler((_,__,callback)=>callback(false));
    session.defaultSession.setPermissionCheckHandler(()=>false);
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'文件',submenu:[{role:'quit',label:'退出'}]},
      {label:'编辑',submenu:[{role:'undo',label:'撤销'},{role:'redo',label:'重做'},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},
      {label:'显示',submenu:[{role:'resetZoom',label:'恢复默认大小'},{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{type:'separator'},{role:'togglefullscreen',label:'全屏展示'}]},
      {label:'帮助',submenu:[{label:'下载与更新',click:()=>shell.openExternal('https://github.com/ho2006/carsonbench/releases')},{label:'关于 CarsonBench',click:()=>dialog.showMessageBox(mainWindow,{type:'info',title:'CarsonBench',message:`CarsonBench ${app.getVersion()}`,detail:'当 DeepSeek 遇见卡森\n原创代码：MIT\n原著与译文节选保留原版权。\nAPI 按账户实际使用计费。'})}]},
    ]));
    await createWindow();
    app.on('activate',()=>{if(!mainWindow)createWindow();});
  }).catch(error=>{console.error(error);app.exit(1);});
}
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
