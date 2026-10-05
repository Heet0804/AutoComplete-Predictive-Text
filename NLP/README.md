# Gujarati Autocomplete and Predictive Text (NLP)

A static website that suggests Gujarati words as you type, like a search-box dropdown.
It uses classic n-gram language models (unigram, bigram, trigram) with backoff.
There is **no server, no database and no API**: the trained model is a plain data file that the browser reads.

## What it does
- **Next-word prediction:** type a word and a space (e.g. `એક `) and the dropdown shows the words that most often come next.
- **Word completion:** type the start of a word (e.g. `એક વ`) and it shows words that begin with it.
- **Sentence end:** when the model is confident a sentence is finished, it suggests a full stop (`.`). After a full stop the dropdown stays quiet until you type the next word.
- **No repeats:** word pairs, triples and whole sentences you already typed are ranked lower, so it does not push you to repeat yourself.
- **Keyboard use:** `↑` / `↓` to move, `Tab` or `Enter` to accept, `Esc` to close. Clicking a row also works.
- English or other non-Gujarati typing shows no suggestions.

## How it works (short)
1. `build_model.py` reads the corpus, keeps only Gujarati script, and counts how often each word follows the previous one or two words. It also marks sentence start and end.
2. It prunes rare entries (top 5 per context, words seen at least twice) and saves the result as `web/model.js` (and as `.pkl` files).
3. `web/autocomplete.js` loads `model.js` in the browser. For each keystroke it looks at the last two words and uses **stupid backoff**: trigram score x 1.0, then bigram x 0.4, then unigram x 0.16. Scores are ranked and the top 6 are shown.
4. A sentence-end check (`.` is offered when at least 50% likely, or after 18 words) and a repetition penalty are applied on top.

## Project structure
```
NLP/
├── data/gujarati_corpus.txt   65,000 Gujarati sentences, one per line
├── build_model.py             trains the n-gram models and writes the model files
├── final_unigram.pkl          saved unigram model (Python)
├── final_bigram.pkl           saved bigram model (Python)
├── final_trigram.pkl          saved trigram model (Python)
├── README.md
└── web/
    ├── index.html             the page
    ├── autocomplete.js        suggestion logic and dropdown
    └── model.js               the trained model as data (loaded by the page)
```

## How to run
1. Open a terminal in the `NLP` folder and run: `python build_model.py`
   (Python 3, standard library only. Expected output: `Words: 551718 | Vocabulary: 21212 | Bigram contexts: 21213 | Trigram contexts: 157996`)
2. Start a local server: `cd web` then `python -m http.server 8000`
3. Open `http://localhost:8000` and type, for example: `એક `, `બે `, `સફેદ `, `એક વ`, `એક બિલાડી `

Opening `web/index.html` directly also works, because the model is a `.js` file.

## Results
Measured on 3,250 held-out sentences (5% of the corpus, not used for training), using a separate test script:

| Model | Right word in top 1 | top 3 | top 5 |
|---|---|---|---|
| Unigram | 5% | 16% | 22% |
| Bigram | 23% | 36% | 42% |
| Trigram + backoff | 26% | 38% | 44% |

Word completion saved about 61% of keystrokes with a 5-item dropdown.
These are approximate figures from my own test; the test script is not part of this folder.

## Dataset
The Gujarati side of the English-Gujarati parallel corpus by **shahparth123**
(https://github.com/shahparth123/eng_guj_parallel_corpus), about 65,000 sentences developed at
the Language Processing Laboratory, Uka Tarsadia University. The sentences are Gujarati translations of
MSCOCO image captions. Please follow that repository's citation and license notes.

## Reference
Abhiram4004/Autocomplete (https://github.com/Abhiram4004/Autocomplete) – an n-gram autocomplete project
used as a reference for the general approach. No code was copied from it.

## Limitations
- The data is image-caption text, so suggestions are best for descriptive phrases (people, animals, vehicles, food, rooms) and weak for everyday chat.
- n-gram models only see the last two words, so they do not understand meaning and can suggest odd combinations.
- A larger and more varied corpus (news, Wikipedia) or a neural model (e.g. LSTM) would improve accuracy.

## Privacy and external requests
Everything runs in the browser. Nothing you type is sent anywhere. The page makes no API calls.
The only external request is the Google Fonts stylesheet for the Gujarati font; it can be removed
(delete the two `<link>` lines in `web/index.html`) and the page then uses the system Gujarati font.

## Development note
An AI assistant (Claude by Anthropic) was used during development for code drafting and debugging.
The finished project does not use any AI service or API at runtime. 