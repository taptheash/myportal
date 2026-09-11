import React, { useState, useEffect, useRef } from 'react';

const QUOTES = [
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
  { text: "The universe is under no obligation to make sense to you.", author: "Neil deGrasse Tyson" },
  { text: "A day without laughter is a day wasted.", author: "Charlie Chaplin" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "The brain is wider than the sky.", author: "Emily Dickinson" },
  { text: "Reality is merely an illusion, albeit a very persistent one.", author: "Albert Einstein" },
  { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
  { text: "Two things are infinite: the universe and human stupidity. And I'm not sure about the universe.", author: "Albert Einstein" },
  { text: "The opposite of a correct statement is a false statement. But the opposite of a profound truth may well be another profound truth.", author: "Niels Bohr" },
  { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
  { text: "If you tell the truth, you don't have to remember anything.", author: "Mark Twain" },
  { text: "Somewhere, something incredible is waiting to be known.", author: "Carl Sagan" },
  { text: "The more I learn, the more I realize how much I don't know.", author: "Albert Einstein" },
  { text: "Adventure is worthwhile in itself.", author: "Amelia Earhart" },
  { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
  { text: "That's one small step for man, one giant leap for mankind.", author: "Neil Armstrong" },
  // Fun Facts
  { text: "🐙 Octopuses have three hearts, blue blood, and can taste with their suckers.", author: "Fun Fact" },
  { text: "🍯 Honey never spoils. Archaeologists found 3,000-year-old honey in Egyptian tombs — still edible.", author: "Fun Fact" },
  { text: "🌍 If you dug a hole straight through Earth from the US, you'd come out in the Indian Ocean, not China.", author: "Fun Fact" },
  { text: "🦈 Sharks are older than trees. They've existed for ~450 million years, trees for ~350 million.", author: "Fun Fact" },
  { text: "🌙 The Moon is slowly drifting away from Earth at about 3.8 cm per year.", author: "Fun Fact" },
  { text: "🐦 A group of flamingos is called a flamboyance. Which seems exactly right.", author: "Fun Fact" },
  { text: "⚡ Lightning strikes Earth about 100 times every second.", author: "Fun Fact" },
  { text: "🧠 Your brain generates enough electricity while you sleep to power a small lightbulb.", author: "Fun Fact" },
  { text: "🐜 Ants never sleep. They take hundreds of tiny power naps throughout the day instead.", author: "Fun Fact" },
  { text: "🌊 The ocean produces over 50% of Earth's oxygen — more than all forests combined.", author: "Fun Fact" },
  { text: "📡 The Voyager 1 spacecraft, launched in 1977, is now over 23 billion kilometers from Earth.", author: "Fun Fact" },
  { text: "🦩 Flamingos are born white. They turn pink from the pigments in the algae and shrimp they eat.", author: "Fun Fact" },
  { text: "🧊 Hot water can freeze faster than cold water under certain conditions. It's called the Mpemba effect.", author: "Fun Fact" },
  { text: "🐘 Elephants are the only animals that can't jump. They're also the only ones with four knees.", author: "Fun Fact" },
  { text: "🌿 Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid.", author: "Fun Fact" },
  // Fun Thoughts
  { text: "🤔 If you replace your broom every year and its handle every other year, is it still the same broom?", author: "Fun Thought" },
  { text: "🤔 At some point, someone had to invent the first joke. And someone else had to decide it was funny.", author: "Fun Thought" },
  { text: "🤔 We say we 'sleep like a baby' to mean sleeping well, but babies wake up every two hours screaming.", author: "Fun Thought" },
  { text: "🤔 Somewhere out there, a dog is dreaming about the best day of its life — and you were probably in it.", author: "Fun Thought" },
  { text: "🤔 The word 'bed' actually looks like a bed. Language is wild.", author: "Fun Thought" },
  { text: "🤔 Every number you've ever counted to, someone else has counted to as well.", author: "Fun Thought" },
  { text: "🤔 Nothing is on fire, fire is on things.", author: "Fun Thought" },
  { text: "🤔 Your future self is watching you right now through memories.", author: "Fun Thought" },
  { text: "🤔 If you're waiting for a waiter, aren't you the waiter?", author: "Fun Thought" },
  { text: "🤔 Technically, every photo ever taken was taken on a Friday from someone's perspective.", author: "Fun Thought" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function DailyQuote() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const shuffledRef = useRef(shuffle(QUOTES));

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setVisible(false);
      setTimeout(() => {
        setQuoteIndex((prev) => {
          const next = prev + 1;
          // Re-shuffle when we've gone through all quotes
          if (next >= shuffledRef.current.length) {
            shuffledRef.current = shuffle(QUOTES);
            return 0;
          }
          return next;
        });
        setVisible(true);
      }, 400);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const current = shuffledRef.current[quoteIndex];

  return (
    <div
      className="flex-1 flex items-center px-10 min-w-0"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease-in-out',
      }}
    >
      <p className="text-xl font-medium text-gray-600 dark:text-gray-200 italic leading-tight w-full">
        {current.text}
      </p>
    </div>
  );
}
