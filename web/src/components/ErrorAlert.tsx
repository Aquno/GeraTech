import type { UserMessage } from '../lib/errors';

interface Props {
  message: UserMessage;
  action?: { label: string; onClick: () => void };
}

/** Mensagem de erro anunciada por leitores de tela (role="alert"). */
export function ErrorAlert({ message, action }: Props) {
  return (
    <div className="alert" role="alert">
      <p className="alert-title">{message.title}</p>
      {message.details.length > 0 && (
        <ul className="alert-details">
          {message.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
      {action && (
        <button type="button" className="button button-secondary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
