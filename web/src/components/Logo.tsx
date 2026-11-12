import icon from '../assets/imagens/chodo-icone-96.webp';
import logoComNomeFundo from '../assets/imagens/chodo-logo-nome-fundo.webp';
import logoComNome from '../assets/imagens/chodo-logo-nome.webp';

// Logo da Chodó Burger, fornecida pelo autor (originais em src/assets/imagens/).

/** Só o desenho, para o cabeçalho. Decorativo: o nome da marca vem em texto logo ao lado. */
export function Logo() {
  return <img src={icon} alt="" className="logo-mark" width={52} height={48} decoding="async" />;
}

/**
 * Logo com o nome, para o rodapé. Duas versões, alternadas pelo tema no CSS: a transparente no tema claro
 * e a com fundo creme no escuro, onde o nome marrom-escuro sumiria. Decorativa: o nome já está no cabeçalho.
 */
export function LogoWithName() {
  return (
    <span className="logo-full">
      <img src={logoComNome} alt="" className="logo-full-light" width={240} height={246} loading="lazy" decoding="async" />
      <img src={logoComNomeFundo} alt="" className="logo-full-dark" width={300} height={311} loading="lazy" decoding="async" />
    </span>
  );
}
