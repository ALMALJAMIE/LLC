import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Password input with a show / hide button.
 *  inline: renders input + button as siblings (for auth fields that already have a flex wrapper). */
export default function PasswordInput({ inline = false, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { inline?: boolean }) {
  const [show, setShow] = useState(false);
  const btn = (
    <button type="button" tabIndex={-1} onClick={() => setShow(!show)} title={show ? 'Hide password' : 'Show password'} aria-label={show ? 'Hide password' : 'Show password'}
      className={`text-slate-400 hover:text-indigo-600 shrink-0 ${inline ? '' : 'absolute top-1/2 -translate-y-1/2 end-3'}`}>
      {show ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
  const input = <input {...props} type={show ? 'text' : 'password'} className={inline ? className : `${className} pe-10`} />;
  return inline ? <>{input}{btn}</> : <div className="relative">{input}{btn}</div>;
}
