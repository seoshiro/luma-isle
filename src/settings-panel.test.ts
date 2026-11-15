import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsPanel } from './SettingsPanel.tsx';
import { createInitialState } from './game.ts';
import { copy } from './i18n.ts';
import { readFileSync } from 'node:fs';
function flatten(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...flatten(node.props.children as ReactNode)];
}
test('settings retain localized controls and explicit selected states in both languages', () => {
  for (const language of ['ru','en'] as const) {
    const settings = { ...createInitialState().settings, language, sound: false, volume: .42 };
    const calls: string[] = [];
    const panel = SettingsPanel({ settings, saveError:false, audioError:null, onChange: value => calls.push(JSON.stringify(value)), onToggleSound:()=>calls.push('sound'), onClose:()=>calls.push('close'), onReplay:()=>calls.push('replay'), onExport:()=>calls.push('export'), onImport:()=>calls.push('import'), onReset:()=>calls.push('reset') });
    const html = renderToStaticMarkup(panel), t = copy[language];
    for (const label of [t.settings,t.sound,t.lighting,t.quality,t.export,t.import,t.reset,t.saved]) assert.ok(html.includes(label), label);
    assert.match(html, /role="switch" aria-checked="false"/);
    assert.match(html, /id="master-volume".*value="0.42"/);
    assert.equal((html.match(/aria-pressed="true"/g) || []).length, 3);
    assert.doesNotMatch(html, /undefined|NaN/);
    const buttons = flatten(panel).filter(element => element.type === 'button');
    for (const button of buttons) (button.props.onClick as () => void)();
    for (const action of ['sound','close','replay','export','import','reset']) assert.ok(calls.includes(action), action);
    assert.ok(calls.includes('{"quality":"low"}')); assert.ok(calls.includes('{"language":"en"}'));
  }
});
test('settings preserve audio and save failure messages', () => {
  const html=renderToStaticMarkup(createElement(SettingsPanel, {settings:createInitialState().settings, saveError:true,audioError:'unavailable',onChange:()=>{},onToggleSound:()=>{},onClose:()=>{},onReplay:()=>{},onExport:()=>{},onImport:()=>{},onReset:()=>{}}));
  assert.ok(html.includes(copy.ru.saveError)); assert.match(html, /role="status"/);
});
test('interface uses local licensed Cyrillic font and ordered stylesheet', () => {
  const main=readFileSync(new URL('./main.tsx',import.meta.url),'utf8');
  assert.ok(main.indexOf("./island-interface.css")>main.indexOf("./styles.css"));
  const css=readFileSync(new URL('./island-interface.css',import.meta.url),'utf8');
  assert.match(css, /font-family:'Luma Manrope'/); assert.match(css, /font-display:swap/);
  const font=readFileSync(new URL('../public/fonts/Manrope-Variable.ttf',import.meta.url));
  assert.equal(font.readUInt32BE(0),0x00010000); assert.ok(font.length>100000);
  assert.match(readFileSync(new URL('../public/fonts/Manrope-OFL.txt',import.meta.url),'utf8'), /SIL OPEN FONT LICENSE/);
});

test('small settings text palette exceeds 4.5:1 contrast', () => {
  const luminance = (hex: string) => {
    const channels = hex.match(/../g)!.map(channel=>parseInt(channel,16)/255).map(value=>value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4));
    return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  };
  for(const [foreground,background] of [['576d55','f1f3ec'],['5b6f62','e9eee5'],['61765d','fffefa'],['845b48','eef2e9'],['576d55','edf1e8'],['596f59','f7f8f2']]){
    assert.ok((luminance(background)+.05)/(luminance(foreground)+.05)>=4.5,foreground);
  }
});
