import { Blobatar } from "@blobatar/react";
import "blobatar/motion.css";
import { happy, idle, sad, surprised, thinking, wink } from "blobatar/expression";
import type { ReactNode } from "react";

/**
 * Wayra, la guía de los retos ("viento" en quechua). La dibuja blobatar en el
 * mismo navegador, sin pedir nada a internet. Siempre es la misma porque sale
 * de un nombre fijo; la expresión acompaña lo que pasa en el juego.
 */
export const GUIDE_NAME = "Wayra";

const LOOK = { name: "nub", traits: { shape: 0.74 }, hue: 150 } as const;

const EXPRESSIONS = { idle, happy, thinking, surprised, sad, wink } as const;
export type Mood = keyof typeof EXPRESSIONS;

export function GuideAvatar({ mood = "idle", size = 88 }: { mood?: Mood; size?: number }) {
  return (
    <Blobatar
      {...LOOK}
      animate="always"
      expression={EXPRESSIONS[mood]}
      width={size}
      height={size}
      aria-hidden="true"
      className="guide-avatar"
    />
  );
}

type Props = {
  readonly mood?: Mood;
  readonly message: string;
  readonly children?: ReactNode;
};

/** Wayra con su globo de diálogo. El mensaje se anuncia a los lectores de pantalla. */
export function Guide({ mood = "idle", message, children }: Props) {
  return (
    <div className="guide" data-mood={mood}>
      <GuideAvatar mood={mood} />
      <div className="guide-bubble">
        <strong className="guide-name">{GUIDE_NAME}</strong>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {children}
      </div>
    </div>
  );
}
