import { useEffect, useRef } from "react";
import { Icon } from "../../shared/ui/Icon";
import { canSpeak, speak, stopSpeaking } from "./speech";

export type PublicQuestion = {
  readonly stage: number;
  readonly prompt: string;
  readonly options: readonly string[];
  readonly points: number;
};

type Props = {
  readonly question: PublicQuestion;
  readonly busy: boolean;
  readonly onAnswer: (option: number) => void;
};

const LETTERS = ["A", "B", "C", "D"];

const readAloud = (q: PublicQuestion) =>
  speak(`${q.prompt}. ${q.options.map((o, i) => `${LETTERS[i]}: ${o}`).join(". ")}.`);

export function QuestionDialog({ question, busy, onAnswer }: Props) {
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
    readAloud(question);
    return stopSpeaking;
  }, [question]);

  return (
    <div className="dialog-backdrop">
      <div className="dialog kid" role="dialog" aria-modal="true" aria-labelledby="question-title">
        <div className="row spread">
          <span className="badge">Pregunta {question.stage + 1}</span>
          {canSpeak() && (
            <button className="btn" type="button" onClick={() => readAloud(question)} aria-label="Escuchar otra vez">
              <Icon name="volume" /> Escuchar
            </button>
          )}
        </div>
        <h2 id="question-title" style={{ marginTop: 12 }}>
          {question.prompt}
        </h2>
        <div className="options">
          {question.options.map((option, i) => (
            <button
              key={i}
              ref={i === 0 ? first : undefined}
              className="option"
              type="button"
              disabled={busy}
              aria-label={`${LETTERS[i]}. ${option}`}
              onClick={() => onAnswer(i)}
            >
              <span className="option-letter" aria-hidden="true">
                {LETTERS[i]}
              </span>
              <span>{option}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
