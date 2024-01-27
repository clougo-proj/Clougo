// Adapted from https://github.com/soyjavi/vanilla-terminal
// Licence: MIT License (see `LICENSE` for details)

const KEY = 'VanillaTerm';
const INPUT_ID = '\"term-input\"';

function cloneCommandNode (el) {
  const line = el.cloneNode(true);
  const input = line.querySelector('.input');

  input.autofocus = false;
  input.readOnly = true;
  input.insertAdjacentHTML('beforebegin', input.value);
  input.parentNode.removeChild(input);
  line.classList.add('line');

  return line;
}

function markup ({ shell: { prompt } }) {
  return (`
  <div class="container">
    <output></output>
    <div class="command">
      <div class="prompt">${prompt}</div>
      <input id=${INPUT_ID} class="input" spellcheck="false" />
    </table>
  </div>
`);
}

export class VanillaTerminal {
  constructor(props = {}) {
    const {
      container = 'vanilla-terminal',
      welcome = 'Welcome to <a href="">Vanilla</a> terminal.',
      prompt = '',
    } = props;
    this.history = window.localStorage[KEY] ? JSON.parse(window.localStorage[KEY]) : [];
    this.historyCursor = this.history.length;
    this.welcome = welcome;
    this.shell = { prompt };

    const el = document.getElementById(container);
    if (el) {
      this.cacheDOM(el);
      this.addListeners();
      if (welcome) this.output(welcome);
    } else throw Error(`Container #${container} doesn't exists.`);
  }

  state = {
    prompt: undefined,
    idle: undefined,
  };

  cacheDOM = (el) => {
    el.classList.add(KEY);
    el.insertAdjacentHTML('beforeEnd', markup(this));

    // Cache DOM nodes
    const container = el.querySelector('.container');
    this.DOM = {
      container,
      output: container.querySelector('output'),
      command: container.querySelector('.command'),
      input: container.querySelector('.command .input'),
      prompt: container.querySelector('.command .prompt'),
    };
  }

  addListeners = () => {
    const { DOM } = this;
    DOM.output.addEventListener('DOMSubtreeModified', () => {
      setTimeout(() => DOM.input.scrollIntoView(), 10);
    }, false);

    DOM.input.addEventListener('keyup', this.onKeyUp, false);
    DOM.input.addEventListener('keydown', this.onKeyDown, false);
    DOM.command.addEventListener('click', () => DOM.input.focus(), false);

    window.addEventListener('keyup', (event) => {
      if (document.activeElement.id === INPUT_ID) {
        DOM.input.focus();
        event.stopPropagation();
        event.preventDefault();
      }
    }, false);
  }

  onKeyUp = (event) => {
    const { keyCode } = event;
    const { DOM, history = [], historyCursor } = this;

    if (keyCode === 27) { // ESC key
      DOM.input.value = '';
      event.stopPropagation();
      event.preventDefault();
    } else if ([38, 40].includes(keyCode)) {
      if (keyCode === 38 && historyCursor > 0) this.historyCursor -= 1; // {38} UP key
      if (keyCode === 40 && historyCursor < history.length - 1) this.historyCursor += 1; // {40} DOWN key

      if (history[this.historyCursor]) DOM.input.value = history[this.historyCursor];
    }
  }

  onKeyDown = ({ keyCode }) => {
    const {
      DOM, history, onInputCallback, state,
    } = this;
    const commandLine = DOM.input.value.trim();
    if (keyCode !== 13) return;

    // Save command line in history
    history.push(commandLine);
    window.localStorage[KEY] = JSON.stringify(history);
    this.historyCursor = history.length;

    // Clone command as a new output line
    DOM.output.appendChild(cloneCommandNode(DOM.command));

    // Clean command line
    DOM.command.classList.add('hidden');
    DOM.input.value = '';

    if (onInputCallback) onInputCallback(commandLine);
  }

  resetCommand = () => {
    const { DOM } = this;

    DOM.input.value = '';
    DOM.command.classList.remove('input');
    DOM.command.classList.remove('hidden');
    if (DOM.input.scrollIntoView) DOM.input.scrollIntoView();
  }

  clear() {
    this.DOM.output.innerHTML = '';
    this.resetCommand();
  }

  idle() {
    const { DOM } = this;

    DOM.command.classList.add('idle');
    DOM.prompt.innerHTML = '<div class="spinner"></div>';
  }

  onInput(callback) {
    this.onInputCallback = callback;
  }

  output(html = '&nbsp;') {
    const { DOM } = this;

    DOM.output.insertAdjacentHTML('beforeEnd', `<span>${html}</span>`);
    if (DOM.prompt.scrollIntoView) DOM.prompt.scrollIntoView();
    this.resetCommand();
  }

  setPrompt(prompt = this.shell.prompt) {
    const { DOM } = this;

    this.shell = { prompt };
    DOM.command.classList.remove('idle');
    DOM.prompt.innerHTML = `${prompt}`;
  }
}
