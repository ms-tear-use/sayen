export const games = [
  {
    id: 'would_you_rather',
    title: 'Would you rather',
    description: 'Two choices. Compare after you both answer.',
    answerStyle: 'choice',
    daily: false,
    prompts: [
      { prompt: 'Would you rather have a long weekend away or a quiet day at home?', optionA: 'a long weekend away', optionB: 'a quiet day at home' },
      { prompt: 'Would you rather cook together or order something easy?', optionA: 'cook together', optionB: 'order something easy' },
      { prompt: 'Would you rather stay up talking or fall asleep early?', optionA: 'stay up talking', optionB: 'fall asleep early' },
      { prompt: 'Would you rather plan the day or decide as you go?', optionA: 'plan the day', optionB: 'decide as you go' },
      { prompt: 'Would you rather revisit a favorite place or try somewhere new?', optionA: 'a favorite place', optionB: 'somewhere new' },
    ],
  },
  {
    id: 'this_or_that',
    title: 'This or that',
    description: 'A quick pick between two small things.',
    answerStyle: 'choice',
    daily: false,
    prompts: [
      { prompt: 'Morning light or evening light?', optionA: 'morning light', optionB: 'evening light' },
      { prompt: 'Coffee or tea?', optionA: 'coffee', optionB: 'tea' },
      { prompt: 'Window seat or aisle energy?', optionA: 'window seat', optionB: 'aisle' },
      { prompt: 'Voice note or text?', optionA: 'voice note', optionB: 'text' },
      { prompt: 'Sweet or salty?', optionA: 'sweet', optionB: 'salty' },
    ],
  },
  {
    id: 'daily_question',
    title: 'Daily question',
    description: 'One shared question for today.',
    answerStyle: 'text',
    daily: true,
    prompts: [
      { prompt: 'What would make today feel a little easier?' },
      { prompt: 'What is something small you want to remember from this week?' },
      { prompt: 'What are you looking forward to next?' },
      { prompt: 'What is a place you keep thinking about?' },
      { prompt: 'What is one thing you want more of this month?' },
    ],
  },
  {
    id: 'guess_my_answer',
    title: 'Guess my answer',
    description: 'Write what you think they would say.',
    answerStyle: 'text',
    daily: false,
    prompts: [
      { prompt: 'What would they say is their comfort meal?' },
      { prompt: 'What would they pick for a low-key evening?' },
      { prompt: 'What song would they put on first?' },
      { prompt: 'What would they say they need after a long day?' },
      { prompt: 'Where would they want to go with no plans?' },
    ],
  },
  {
    id: 'trivia',
    title: 'Trivia',
    description: 'A light question, then both answers.',
    answerStyle: 'text',
    daily: false,
    prompts: [
      { prompt: 'Which planet is known for its rings?', answer: 'Saturn' },
      { prompt: 'How many continents are there?', answer: '7' },
      { prompt: 'What is the largest ocean on Earth?', answer: 'Pacific' },
      { prompt: 'Which animal is known for having a pouch?', answer: 'a kangaroo, or another marsupial' },
      { prompt: 'What color do you get from blue and yellow?', answer: 'green' },
    ],
  },
]

export function gameById(id) {
  return games.find((game) => game.id === id) || null
}
