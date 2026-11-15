import { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';

export const presentationCopy = {
  ru: {
    title: 'Остров пока не открылся', lost: 'Связь с графикой прервалась',
    body: 'Браузер не смог показать трёхмерный мир. Можно попробовать ещё раз или сохранить прохождение в файл.',
    advice: 'Если это повторяется, закройте лишние вкладки и проверьте аппаратное ускорение в настройках браузера.',
    retry: 'Попробовать снова', export: 'Скачать сохранение', saved: 'Ваш прогресс сохранён в этом браузере.',
    unsaved: 'Браузер не разрешил автосохранение. Скачайте файл, чтобы не потерять прогресс.',
    loading: 'Собираем маленький мир', wait: 'Подготавливаем остров и его детали…',
    degraded: 'Некоторые детали не загрузились. Остров и все загадки доступны.',
    volume: 'Общая громкость', audioError: 'Звук не загрузился. Выключите и снова включите его, чтобы повторить.',
  },
  en: {
    title: 'The island could not open yet', lost: 'The graphics connection was interrupted',
    body: 'Your browser could not display the three-dimensional world. Try again or download your progress.',
    advice: 'If this happens again, close unused tabs and check hardware acceleration in your browser settings.',
    retry: 'Try again', export: 'Download save', saved: 'Your progress is saved in this browser.',
    unsaved: 'Your browser could not save automatically. Download your save to keep your progress.',
    loading: 'Gathering a little world', wait: 'Preparing the island and its details…',
    degraded: 'Some details could not load. The island and every puzzle are still available.',
    volume: 'Master volume', audioError: 'Audio could not load. Switch sound off and on to try again.',
  },
};

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function RecoveryScreen({ language, contextLost, saveHealthy, onRetry, onExport }: {
  language: 'ru' | 'en'; contextLost: boolean; saveHealthy: boolean;
  onRetry: () => void; onExport: () => void;
}) {
  const t = presentationCopy[language];
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  return <section className="recovery-screen" aria-labelledby="recovery-title">
    <img className="recovery-poster" src={`${import.meta.env.BASE_URL}fallback-poster.png`} alt="" />
    <div className="recovery-card">
      <span className="eyebrow">LUMA ISLE</span>
      <h1 id="recovery-title" tabIndex={-1} ref={title}>{contextLost ? t.lost : t.title}</h1>
      <p>{t.body}</p>
      <div className="recovery-actions"><button className="primary" onClick={onRetry}><RotateCcw size={18} />{t.retry}</button><button className="small-pill" onClick={onExport}><Download size={18} />{t.export}</button></div>
      <p className="recovery-save">{saveHealthy ? t.saved : t.unsaved}</p>
      <p className="recovery-advice">{t.advice}</p>
    </div>
  </section>;
}

export function SceneLoading({ language }: { language: 'ru' | 'en' }) {
  const t = presentationCopy[language];
  return <section className="scene-loading" role="status" aria-live="polite"><span className="eyebrow">LUMA ISLE</span><h1>{t.loading}</h1><p>{t.wait}</p><span className="loading-dot" aria-hidden="true" /></section>;
}
