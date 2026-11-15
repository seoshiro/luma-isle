import type { CSSProperties } from 'react';
import { ArrowRight, Check, Download, Globe2, Leaf, Moon, RotateCcw, ShieldCheck, Sun, Sunset, Upload, Volume2, VolumeX, Wind, X } from 'lucide-react';
import type { Settings } from './game';
import { copy } from './i18n';
import { presentationCopy } from './RecoveryScreen';

const detail = {
  ru: { ambience: 'Атмосфера', display: 'Изображение', progress: 'Твоё путешествие', audio: 'Ветер, вода и маленькие жители', silent: 'Остров сейчас без звука', quality: 'Меньше деталей — легче для устройства', replay: 'Вернуться к первому впечатлению', subtitle: 'Немного настроек. Больше тишины.', language: 'Язык интерфейса' },
  en: { ambience: 'Atmosphere', display: 'Display', progress: 'Your journey', audio: 'Wind, water and little inhabitants', silent: 'The island is quiet for now', quality: 'Fewer details, lighter on your device', replay: 'Revisit the first impression', subtitle: 'A few settings. A little more calm.', language: 'Interface language' },
};
interface SettingsPanelProps {
  settings: Settings;
  saveError: boolean;
  audioError: string | null;
  onChange: (value: Partial<Settings>) => void;
  onToggleSound: () => void;
  onClose: () => void;
  onReplay: () => void;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
}
export function SettingsPanel({ settings, saveError, audioError, onChange, onToggleSound, onClose, onReplay, onExport, onImport, onReset }: SettingsPanelProps) {
  const t = copy[settings.language], p = presentationCopy[settings.language], d = detail[settings.language];
  return <>
    <header className="settings-header">
      <div><span className="settings-kicker">LUMA ISLE <i aria-hidden="true" /></span><h2>{t.settings}</h2><p>{d.subtitle}</p></div>
      <button className="settings-close" onClick={onClose} aria-label={t.close}><X size={20}/></button>
    </header>
    <div className="settings-body">
      <div className="settings-language"><span><Globe2 size={17}/>{t.language}</span><div className="settings-segment language-segment" role="group" aria-label={d.language}>{(['ru', 'en'] as const).map(language => <button key={language} lang={language} aria-pressed={settings.language === language} onClick={() => onChange({ language })}>{language.toUpperCase()}</button>)}</div></div>
      <fieldset className="settings-section"><legend>{d.ambience}</legend>
        <div className="sound-card">
          <div className="sound-row"><span className="setting-symbol">{settings.sound ? <Volume2 size={20}/> : <VolumeX size={20}/>}</span><span className="setting-label"><strong>{t.sound}</strong><small>{settings.sound ? d.audio : d.silent}</small></span><button className={`settings-toggle ${settings.sound ? 'enabled' : ''}`} role="switch" aria-checked={settings.sound} aria-label={t.sound} onClick={onToggleSound}><i/></button></div>
          <div className={`settings-volume ${settings.sound ? '' : 'is-muted'}`}><label htmlFor="master-volume">{p.volume}<output htmlFor="master-volume">{Math.round(settings.volume * 100)}<small>%</small></output></label><input id="master-volume" type="range" min="0" max="1" step="0.01" value={settings.volume} style={{'--volume': `${settings.volume * 100}%`} as CSSProperties} onChange={event => onChange({ volume: +event.target.value })}/></div>
          {audioError && <p className="settings-error" role="status">{p.audioError}</p>}
        </div>
        <div className="setting-title">{t.lighting}</div><div className="lighting-choices" role="group" aria-label={t.lighting}>{(['morning', 'sunset', 'night'] as const).map((lighting, index) => { const Icon = [Sun, Sunset, Moon][index]; return <button className={`lighting-choice ${lighting}`} key={lighting} aria-pressed={settings.lighting === lighting} onClick={() => onChange({ lighting })}><Icon size={21}/><span>{t[lighting]}</span>{settings.lighting === lighting && <Check className="choice-check" size={11}/>}</button>; })}</div>
      </fieldset>
      <fieldset className="settings-section display-section"><legend>{d.display}</legend><div className="setting-title">{t.quality}<Leaf size={16}/></div><div className="settings-segment quality-segment" role="group" aria-label={t.quality}>{(['low', 'medium', 'high'] as const).map(quality => <button key={quality} aria-pressed={settings.quality === quality} onClick={() => onChange({ quality })}>{t[quality]}</button>)}</div><p className="settings-helper">{d.quality}</p></fieldset>
      <fieldset className="settings-section journey-section"><legend>{d.progress}</legend>
        <button className="replay-setting" onClick={onReplay}><Wind size={19}/><span><strong>{t.replay}</strong><small>{d.replay}</small></span><ArrowRight size={17}/></button>
        <div className="save-actions"><button onClick={onExport}><Download size={18}/><span>{t.export}</span></button><button onClick={onImport}><Upload size={18}/><span>{t.import}</span></button></div>
      </fieldset>
    </div>
    <footer className="settings-footer"><p className={saveError ? 'settings-error' : ''}><ShieldCheck size={14}/>{saveError ? t.saveError : t.saved}</p><button className="settings-reset" onClick={onReset}><RotateCcw size={14}/>{t.reset}</button></footer>
  </>;
}
