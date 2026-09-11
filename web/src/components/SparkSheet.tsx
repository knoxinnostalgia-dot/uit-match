import { useState, type FormEvent } from 'react';
import { firstName } from '../names';
import type { DeckCard } from '../types';

interface Props {
  card: DeckCard;
  photoIndex: number;
  onClose: () => void;
  onSend: (note: string, photoIndex: number) => void;
}

export default function SparkSheet({ card, photoIndex, onClose, onSend }: Props) {
  const [note, setNote] = useState('');
  const given = firstName(card.displayName);
  const photo = card.photos[photoIndex] ?? card.photos[0];

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = note.trim();
    if (!text) return;
    onSend(text, photoIndex);
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-grip" />
        <p className="eyebrow">Spark</p>
        <h2 className="page-title" style={{ marginTop: 0 }}>
          Like {given} with a line
        </h2>
        <p className="page-sub">They only see this if they like you back. Keep it specific to the photo.</p>

        {photo && (
          <div className="spark-photo" style={{ backgroundImage: `url(${photo})` }} />
        )}

        <form onSubmit={submit}>
          <div className="field">
            <label className="label" htmlFor="spark">Your spark</label>
            <textarea
              id="spark"
              className="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              placeholder={`Something true about this photo…`}
            />
          </div>
          <button className="btn" type="submit" disabled={!note.trim()}>
            Send spark
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClose} style={{ marginTop: 10 }}>
            Cancel
          </button>
        </form>
      </div>
    </>
  );
}
