'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BookText } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { preloadTranslationCache, translateQuestionsOnTheFly, normalizeLang } from '@/lib/translateQuizLite';

/** --------------------------
 *  QUESTION BANK (unchanged content)
 *  -------------------------- */

type Option = { label: string; value: string };
type Question = {
  id: string;
  text: string;
  options: Option[];
  correctIndex: number; // 0-based
};
type Level = 'Easy' | 'Medium' | 'Hard';

type QuizBank = {
  [subject: string]: {
    [chapter: string]: {
      [level in Level]?: Question[];
    };
  };
};

const o = (arr: string[]): Option[] =>
  arr.map((v, i) => ({ label: String.fromCharCode(97 + i) + ') ' + v, value: v }));

const QUIZ_BANK: QuizBank = {
  Physics: {
    Motion: {
      Easy: [
        { id: 'phy-e-1', text: 'A force of 40 N acts at 0° to the horizontal. Its horizontal component is:', options: o(['40 N', '0 N', '20 N', '80 N']), correctIndex: 0 },
        { id: 'phy-e-2', text: 'A force of 10 N acts at 90°. Its horizontal component is:', options: o(['0 N', '10 N', '5 N', '20 N']), correctIndex: 0 },
        { id: 'phy-e-3', text: 'Which component decides how far a projectile travels horizontally?', options: o(['Vertical component', 'Horizontal component', 'Resultant force', 'None']), correctIndex: 1 },
        { id: 'phy-e-4', text: 'The path of a projectile is:', options: o(['Circle', 'Straight line', 'Parabola', 'Ellipse']), correctIndex: 2 },
        { id: 'phy-e-5', text: 'The acceleration acting on a projectile in vertical direction is always:', options: o(['Zero', 'g (downward)', 'g (upward)', 'None']), correctIndex: 1 },
      ],
      Medium: [
        { id: 'phy-m-1', text: 'A force of 60 N acts at 30°. Find the vertical component.', options: o(['30 N', '20 N', '60 N', '40 N']), correctIndex: 0 },
        { id: 'phy-m-2', text: 'A stone is thrown horizontally with 15 m/s from a cliff. After 2 s, vertical displacement is (g = 10 m/s²):', options: o(['10 m', '20 m', '15 m', '25 m']), correctIndex: 1 },
        { id: 'phy-m-3', text: 'A projectile is launched with speed u at angle θ. Maximum height is:', options: [{ label: 'a) (u² cos²θ) / (2g)', value: 'u^2 cos^2θ / 2g' }, { label: 'b) (u² sin²θ) / (2g)', value: 'u^2 sin^2θ / 2g' }], correctIndex: 1 },
        { id: 'phy-m-4', text: 'A ball is projected with 10 m/s at 60°. Time of flight = ? (g = 10)', options: o(['0.8 s', '1.5 s', '1.7 s', '2 s']), correctIndex: 2 },
        { id: 'phy-m-5', text: 'Which of the following remains constant in projectile motion (ideal conditions)?', options: o(['Vertical velocity', 'Horizontal velocity', 'Vertical displacement', 'Acceleration']), correctIndex: 1 },
      ],
      Hard: [
        { id: 'phy-h-1', text: 'A force of 100 N acts at 53°. Find horizontal and vertical components (approx).', options: o(['60 N, 80 N', '80 N, 60 N', '50 N, 90 N', '70 N, 70 N']), correctIndex: 0 },
        { id: 'phy-h-2', text: 'A projectile is thrown at 20 m/s at 30°. Find total time of flight. (g = 10)', options: o(['2 s', '3 s', '4 s', '5 s']), correctIndex: 0 },
        { id: 'phy-h-3', text: 'A stone is projected at 45° with u = 14 m/s. Find maximum height. (g = 9.8)', options: o(['3 m', '5 m', '6 m', '7 m']), correctIndex: 1 },
        { id: 'phy-h-4', text: 'Two projectiles A and B are launched with same speed but at 30° and 60°. Which has more range?', options: o(['A', 'B', 'Both equal', 'Cannot say']), correctIndex: 2 },
        { id: 'phy-h-5', text: 'A ball is thrown with velocity 25 m/s at 45°. Find horizontal range. (g = 10)', options: o(['40 m', '50 m', '60 m', '62.5 m']), correctIndex: 3 },
      ],
    },
  },

  Mathematics: {
    General: {
      Easy: [
        { id: 'math-e-1', text: 'Solve for x: 2x + 7 = 15', options: o(['3', '4', '5', '6']), correctIndex: 1 },
        { id: 'math-e-2', text: 'If the perimeter of a rectangle is 40 cm and its length is 12 cm, width = ?', options: o(['8 cm', '10 cm', '16 cm', '14 cm']), correctIndex: 0 },
        { id: 'math-e-3', text: 'The sum of angles in a quadrilateral is:', options: o(['180°', '360°', '270°', '450°']), correctIndex: 1 },
        { id: 'math-e-4', text: 'If the ratio of two numbers is 3:4 and their sum is 21, the smaller number = ?', options: o(['9', '8', '7', '6']), correctIndex: 0 },
        { id: 'math-e-5', text: 'Find the value of 707^0:', options: o(['0', '1', '7', '49']), correctIndex: 1 },
      ],
      Medium: [
        { id: 'math-m-1', text: 'Solve for x: 5x − 3 = 2x + 12', options: o(['3', '5', '7', '15']), correctIndex: 1 },
        { id: 'math-m-2', text: 'The area of a triangle with base 10 cm and height 6 cm = ?', options: o(['30 cm²', '60 cm²', '36 cm²', '40 cm²']), correctIndex: 0 },
        { id: 'math-m-3', text: 'If x : y = 2 : 3 and x + y = 25, then x = ?', options: o(['10', '12', '15', '20']), correctIndex: 0 },
        { id: 'math-m-4', text: 'Probability of getting a head in a single coin toss = ?', options: o(['0', '1/2', '1/3', '1']), correctIndex: 1 },
        { id: 'math-m-5', text: 'Simplify: 3² × 3³ = ?', options: [{ label: 'a) 3^5', value: '3^5' }, { label: 'b) 3^6', value: '3^6' }, { label: 'c) 9^5', value: '9^5' }, { label: 'd) 6^5', value: '6^5' }], correctIndex: 0 },
      ],
      Hard: [
        { id: 'math-h-1', text: 'Solve for x: 2(x − 3) + 4 = 3x − 5', options: o(['3', '10', '12', '9']), correctIndex: 0 },
        { id: 'math-h-2', text: 'The volume of a cuboid is 720 cm³. If length = 12 cm, breadth = 6 cm, height = ?', options: o(['10 cm', '12 cm', '8 cm', '9 cm']), correctIndex: 0 },
        { id: 'math-h-3', text: 'A bag contains 5 red, 3 blue, and 2 green balls. Probability of picking a blue ball = ?', options: o(['1/2', '1/5', '3/10', '3/5']), correctIndex: 2 },
        { id: 'math-h-4', text: 'If the angles of a triangle are in the ratio 2:3:4, find the largest angle.', options: o(['40°', '60°', '80°', '90°']), correctIndex: 2 },
        { id: 'math-h-5', text: 'Simplify: (2³ × 2²) ÷ 2⁴ = ?', options: o(['2', '4', '8', '16']), correctIndex: 0 },
      ],
    },
  },

  Chemistry: {
    General: {
      Easy: [
        { id: 'chem-e-1', text: 'Water is a:', options: o(['Element', 'Compound', 'Mixture', 'Alloy']), correctIndex: 1 },
        { id: 'chem-e-2', text: 'Which of the following is a gas at room temperature?', options: o(['Sodium', 'Oxygen', 'Iron', 'Mercury']), correctIndex: 1 },
        { id: 'chem-e-3', text: 'NaCl is commonly known as:', options: o(['Sugar', 'Salt', 'Baking soda', 'Lime']), correctIndex: 1 },
        { id: 'chem-e-4', text: 'Which of these is acidic in nature?', options: o(['Lemon juice', 'Soap', 'Milk', 'Salt']), correctIndex: 0 },
        { id: 'chem-e-5', text: 'The formula of carbon dioxide is:', options: o(['CO', 'CO₂', 'C₂O', 'O₂C']), correctIndex: 1 },
      ],
      Medium: [
        { id: 'chem-m-1', text: 'The pH of water is:', options: o(['0', '7', '14', '1']), correctIndex: 1 },
        { id: 'chem-m-2', text: 'Which element is used in making electrical wires?', options: o(['Silver', 'Copper', 'Iron', 'Lead']), correctIndex: 1 },
        { id: 'chem-m-3', text: 'H₂O is made of:', options: o(['2 hydrogen + 1 oxygen', '2 oxygen + 1 hydrogen', '1 hydrogen + 1 oxygen', '3 hydrogen + 1 oxygen']), correctIndex: 0 },
        { id: 'chem-m-4', text: 'Which of the following is a physical change?', options: o(['Burning wood', 'Melting ice', 'Rusting iron', 'Cooking food']), correctIndex: 1 },
        { id: 'chem-m-5', text: 'Common gas in fizzy drinks is:', options: o(['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen']), correctIndex: 1 },
      ],
      Hard: [
        { id: 'chem-h-1', text: 'Atomic number represents:', options: o(['Number of protons', 'Number of neutrons', 'Number of electrons', 'Mass of atom']), correctIndex: 0 },
        { id: 'chem-h-2', text: 'Which of the following is a chemical change?', options: o(['Boiling water', 'Rusting iron', 'Melting wax', 'Dissolving sugar']), correctIndex: 1 },
        { id: 'chem-h-3', text: 'Which of these is an alkali?', options: o(['HCl', 'NaOH', 'H₂SO₄', 'CO₂']), correctIndex: 1 },
        { id: 'chem-h-4', text: 'Formula of baking soda is:', options: o(['NaHCO₃', 'NaCO₃', 'CaCO₃', 'KCl']), correctIndex: 0 },
        { id: 'chem-h-5', text: 'Which element is a noble gas?', options: o(['Oxygen', 'Helium', 'Nitrogen', 'Carbon']), correctIndex: 1 },
      ],
    },
  },

  Biology: {
    General: {
      Easy: [
        { id: 'bio-e-1', text: 'The basic unit of life is:', options: o(['Atom', 'Molecule', 'Cell', 'Tissue']), correctIndex: 2 },
        { id: 'bio-e-2', text: 'Which part of plant makes food?', options: o(['Root', 'Stem', 'Leaf', 'Flower']), correctIndex: 2 },
        { id: 'bio-e-3', text: 'Humans have how many chromosomes?', options: o(['23', '46', '44', '22']), correctIndex: 1 },
        { id: 'bio-e-4', text: 'Which of these is a mammal?', options: o(['Lizard', 'Whale', 'Frog', 'Snake']), correctIndex: 1 },
        { id: 'bio-e-5', text: 'Blood is pumped by the:', options: o(['Lung', 'Heart', 'Kidney', 'Brain']), correctIndex: 1 },
      ],
      Medium: [
        { id: 'bio-m-1', text: 'Photosynthesis needs:', options: o(['Carbon dioxide + Water + Sunlight', 'Oxygen + Water + Sunlight', 'Carbon dioxide + Oxygen', 'Nitrogen + Water']), correctIndex: 0 },
        { id: 'bio-m-2', text: 'The process of shedding old skin is called:', options: o(['Molting', 'Photosynthesis', 'Respiration', 'Germination']), correctIndex: 0 },
        { id: 'bio-m-3', text: 'The largest organ in the human body is:', options: o(['Brain', 'Heart', 'Skin', 'Liver']), correctIndex: 2 },
        { id: 'bio-m-4', text: 'Xylem transports:', options: o(['Water', 'Food', 'Oxygen', 'Minerals']), correctIndex: 0 },
        { id: 'bio-m-5', text: 'Stomata are mainly found on:', options: o(['Roots', 'Leaves', 'Stem', 'Flower']), correctIndex: 1 },
      ],
      Hard: [
        { id: 'bio-h-1', text: 'Which blood cells help in clotting?', options: o(['RBC', 'WBC', 'Platelets', 'Plasma']), correctIndex: 2 },
        { id: 'bio-h-2', text: 'Enzymes in saliva start the digestion of:', options: o(['Proteins', 'Carbohydrates', 'Fats', 'Vitamins']), correctIndex: 1 },
        { id: 'bio-h-3', text: 'The control center of the cell is:', options: o(['Cytoplasm', 'Nucleus', 'Mitochondria', 'Ribosome']), correctIndex: 1 },
        { id: 'bio-h-4', text: 'Which of these is a respiratory pigment?', options: o(['Hemoglobin', 'Chlorophyll', 'Myosin', 'Insulin']), correctIndex: 0 },
        { id: 'bio-h-5', text: 'Fertilization in plants occurs in:', options: o(['Stamen', 'Ovary', 'Pistil', 'Petal']), correctIndex: 1 },
      ],
    },
  },

  History: {
    India: {
      Easy: [
        { id: 'his-e-1', text: 'Who was the first President of India?', options: o(['Jawaharlal Nehru', 'Rajendra Prasad', 'Sardar Patel', 'Indira Gandhi']), correctIndex: 1 },
        { id: 'his-e-2', text: 'India got independence in:', options: o(['1945', '1947', '1950', '1930']), correctIndex: 1 },
        { id: 'his-e-3', text: 'The “Iron Man of India” is:', options: o(['Mahatma Gandhi', 'Sardar Vallabhbhai Patel', 'Jawaharlal Nehru', 'Subhash Chandra Bose']), correctIndex: 1 },
        { id: 'his-e-4', text: 'The Mughal emperor who built the Taj Mahal:', options: o(['Akbar', 'Shah Jahan', 'Aurangzeb', 'Babur']), correctIndex: 1 },
        { id: 'his-e-5', text: 'Who started the Non-Cooperation Movement?', options: o(['Subhash Chandra Bose', 'Mahatma Gandhi', 'Bal Gangadhar Tilak', 'Lala Lajpat Rai']), correctIndex: 1 },
      ],
      Medium: [
        { id: 'his-m-1', text: 'The Battle of Plassey took place in:', options: o(['1757', '1761', '1776', '1789']), correctIndex: 0 },
        { id: 'his-m-2', text: 'Rani Lakshmibai ruled:', options: o(['Jaipur', 'Jhansi', 'Hyderabad', 'Mysore']), correctIndex: 1 },
        { id: 'his-m-3', text: 'The first Governor-General of independent India was:', options: o(['Lord Mountbatten', 'C. Rajagopalachari', 'Rajendra Prasad', 'Lord Curzon']), correctIndex: 0 },
        { id: 'his-m-4', text: '“Discovery of India” was written by:', options: o(['Mahatma Gandhi', 'Jawaharlal Nehru', 'Subhash Chandra Bose', 'Sardar Patel']), correctIndex: 1 },
        { id: 'his-m-5', text: 'Revolt of 1857 is also called:', options: o(['Indian Civil War', 'First War of Independence', 'Sepoy Rebellion', 'Both b and c']), correctIndex: 3 },
      ],
      Hard: [
        { id: 'his-h-1', text: 'Who founded the Indian National Congress?', options: o(['A.O. Hume', 'Bal Gangadhar Tilak', 'Lala Lajpat Rai', 'Dadabhai Naoroji']), correctIndex: 0 },
        { id: 'his-h-2', text: 'Tipu Sultan was defeated by:', options: o(['British East India Company', 'Marathas', 'Mughals', 'French']), correctIndex: 0 },
        { id: 'his-h-3', text: 'The Partition of Bengal happened in:', options: o(['1905', '1911', '1947', '1930']), correctIndex: 0 },
        { id: 'his-h-4', text: 'Which act introduced separate electorates for Muslims?', options: o(['Indian Councils Act 1909', 'Government of India Act 1919', 'Government of India Act 1935', 'Regulating Act 1773']), correctIndex: 0 },
        { id: 'his-h-5', text: 'The famous Dandi March was started in:', options: o(['1920', '1930', '1942', '1919']), correctIndex: 1 },
      ],
    },
  },

  Geography: {
    India: {
      Easy: [
        { id: 'geo-e-1', text: 'The longest river in India is:', options: o(['Yamuna', 'Ganga', 'Godavari', 'Brahmaputra']), correctIndex: 1 },
        { id: 'geo-e-2', text: 'The largest desert in India is:', options: o(['Thar', 'Sahara', 'Kalahari', 'Gobi']), correctIndex: 0 },
        { id: 'geo-e-3', text: 'Mount Everest is located in:', options: o(['India', 'Nepal', 'China', 'Bhutan']), correctIndex: 1 },
        { id: 'geo-e-4', text: 'The Tropic of Cancer passes through how many states of India?', options: o(['5', '8', '6', '7']), correctIndex: 1 },
        { id: 'geo-e-5', text: 'The main source of groundwater is:', options: o(['Lakes', 'Rivers', 'Rainfall', 'Ocean']), correctIndex: 2 },
      ],
      Medium: [
        { id: 'geo-m-1', text: 'India lies in which hemisphere?', options: o(['Northern & Western', 'Northern & Eastern', 'Southern & Eastern', 'Southern & Western']), correctIndex: 1 },
        { id: 'geo-m-2', text: 'The river known as “Sorrow of Bihar” is:', options: o(['Ganga', 'Kosi', 'Brahmaputra', 'Yamuna']), correctIndex: 1 },
        { id: 'geo-m-3', text: 'The largest plateau in India is:', options: o(['Malwa Plateau', 'Deccan Plateau', 'Chota Nagpur Plateau', 'Bundelkhand Plateau']), correctIndex: 1 },
        { id: 'geo-m-4', text: 'Which state has the highest forest cover (area) in India?', options: o(['Madhya Pradesh', 'Arunachal Pradesh', 'Maharashtra', 'Odisha']), correctIndex: 0 },
        { id: 'geo-m-5', text: 'The Andaman and Nicobar Islands are in which ocean?', options: o(['Atlantic', 'Indian', 'Pacific', 'Arctic']), correctIndex: 1 },
      ],
      Hard: [
        { id: 'geo-h-1', text: 'Which river forms the delta known as Sundarbans?', options: o(['Ganga', 'Godavari', 'Mahanadi', 'Brahmaputra']), correctIndex: 0 },
        { id: 'geo-h-2', text: 'Western Ghats are older than:', options: o(['Himalayas', 'Eastern Ghats', 'Aravallis', 'Nilgiris']), correctIndex: 0 },
        { id: 'geo-h-3', text: 'India has how many states and union territories (2025)?', options: o(['28 & 8', '29 & 7', '30 & 8', '28 & 9']), correctIndex: 0 },
        { id: 'geo-h-4', text: 'The highest peak in India (excluding Himalayas) is:', options: o(['Anamudi', 'Nanda Devi', 'Kangchenjunga', 'Saltoro']), correctIndex: 0 },
        { id: 'geo-h-5', text: 'Rainfall is maximum in which region of India?', options: o(['Rajasthan', 'Western Ghats', 'Meghalaya', 'Gujarat']), correctIndex: 2 },
      ],
    },
  },

  Civics: {
    India: {
      Easy: [
        { id: 'civ-e-1', text: 'The Constitution of India came into effect on:', options: o(['15 Aug 1947', '26 Jan 1950', '26 Nov 1949', '2 Oct 1950']), correctIndex: 1 },
        { id: 'civ-e-2', text: 'The head of state in India is:', options: o(['Prime Minister', 'President', 'Chief Justice', 'Governor']), correctIndex: 1 },
        { id: 'civ-e-3', text: 'Fundamental Rights are mentioned in which part of the Constitution?', options: o(['Part I', 'Part III', 'Part II', 'Part IV']), correctIndex: 1 },
        { id: 'civ-e-4', text: 'India is a:', options: o(['Monarchy', 'Federal Republic', 'Dictatorship', 'Oligarchy']), correctIndex: 1 },
        { id: 'civ-e-5', text: 'The National Human Rights Commission (NHRC) protects:', options: o(['Animals', 'Fundamental Rights', 'Environment', 'Trade Rights']), correctIndex: 1 },
      ],
      Medium: [
        { id: 'civ-m-1', text: 'Who is the head of the state legislature?', options: o(['Governor', 'Chief Minister', 'Speaker', 'President']), correctIndex: 0 },
        { id: 'civ-m-2', text: 'Panchayati Raj system was introduced by:', options: o(['42nd Amendment', '73rd Amendment', '86th Amendment', '44th Amendment']), correctIndex: 1 },
        { id: 'civ-m-3', text: 'The tenure of the Lok Sabha is:', options: o(['4 years', '5 years', '6 years', '3 years']), correctIndex: 1 },
        { id: 'civ-m-4', text: 'Right to Freedom of Religion is under which Article?', options: o(['19', '25', '32', '21']), correctIndex: 1 },
        { id: 'civ-m-5', text: 'Which body settles disputes between states and the central government?', options: o(['Supreme Court', 'High Court', 'Parliament', 'President']), correctIndex: 0 },
      ],
      Hard: [
        { id: 'civ-h-1', text: 'Who appoints the Chief Justice of India?', options: o(['Prime Minister', 'President', 'Parliament', 'Governor']), correctIndex: 1 },
        { id: 'civ-h-2', text: 'Impeachment of the President requires:', options: o(['Simple majority', '2/3 majority in both Houses', '3/4 majority in both Houses', 'Approval of Supreme Court']), correctIndex: 1 },
        { id: 'civ-h-3', text: 'India’s political system is based on:', options: o(['British Model', 'American Model', 'French Model', 'Russian Model']), correctIndex: 0 },
        { id: 'civ-h-4', text: 'The Directive Principles of State Policy are:', options: o(['Justiciable', 'Non-justiciable', 'Fundamental Rights', 'Laws of Parliament']), correctIndex: 1 },
        { id: 'civ-h-5', text: 'Fundamental Duties were added by which Amendment?', options: o(['42nd', '44th', '73rd', '86th']), correctIndex: 0 },
      ],
    },
  },

  Economics: {
    General: {
      Easy: [
        { id: 'eco-e-1', text: 'The currency of India is:', options: o(['Dollar', 'Rupee', 'Yen', 'Pound']), correctIndex: 1 },
        { id: 'eco-e-2', text: 'RBI stands for:', options: o(['Regional Bank of India', 'Reserve Bank of India', 'Rural Bank of India', 'Regulatory Bank of India']), correctIndex: 1 },
        { id: 'eco-e-3', text: 'Inflation means:', options: o(['Prices falling', 'Prices rising', 'Stable prices', 'Economic growth']), correctIndex: 1 },
        { id: 'eco-e-4', text: 'GST stands for:', options: o(['General Sales Tax', 'Goods and Services Tax', 'Government Service Tax', 'Global Standard Tax']), correctIndex: 1 },
        { id: 'eco-e-5', text: 'Who prints the currency notes in India?', options: o(['RBI', 'Finance Ministry', 'Supreme Court', 'President']), correctIndex: 0 },
      ],
      Medium: [
        { id: 'eco-m-1', text: 'Which is a renewable resource?', options: o(['Coal', 'Oil', 'Sunlight', 'Natural gas']), correctIndex: 2 },
        { id: 'eco-m-2', text: 'Budget of India is presented by:', options: o(['Prime Minister', 'President', 'Finance Minister', 'Planning Commission']), correctIndex: 2 },
        { id: 'eco-m-3', text: 'The financial year in India runs from:', options: o(['Jan–Dec', 'April–March', 'July–June', 'March–Feb']), correctIndex: 1 },
        { id: 'eco-m-4', text: 'Deflation is:', options: o(['Fall in prices', 'Rise in prices', 'Tax increase', 'Tax decrease']), correctIndex: 0 },
        { id: 'eco-m-5', text: 'Microeconomics studies:', options: o(['Whole economy', 'Individual units', 'Government policy', 'Inflation']), correctIndex: 1 },
      ],
      Hard: [
        { id: 'eco-h-1', text: 'The largest source of revenue for the Government of India is:', options: o(['Tax revenue', 'Non-tax revenue', 'Loans', 'Grants']), correctIndex: 0 },
        { id: 'eco-h-2', text: 'Fiscal deficit occurs when:', options: o(['Expenditure > Revenue', 'Revenue > Expenditure', 'Expenditure = Revenue', 'None']), correctIndex: 0 },
        { id: 'eco-h-3', text: 'NITI Aayog replaced which institution?', options: o(['Planning Commission', 'Finance Commission', 'RBI', 'GST Council']), correctIndex: 0 },
        { id: 'eco-h-4', text: 'The term “GDP” stands for:', options: o(['Gross Domestic Product', 'General Domestic Price', 'Gross Development Plan', 'Government Domestic Production']), correctIndex: 0 },
        { id: 'eco-h-5', text: 'Cooperative banks mainly serve:', options: o(['Farmers', 'Corporates', 'Government', 'Traders']), correctIndex: 0 },
      ],
    },
  },
};

/** --------------------------
 *  NORMALIZE SELECTIONS (unchanged)
 *  -------------------------- */
function normalizeSelection(rawSubject: string, rawChapter: string) {
  const subject = (rawSubject || '').trim();
  const chapter = (rawChapter || '').trim();

  if (subject === 'Science') {
    if (/^motion$/i.test(chapter)) return { subject: 'Physics', chapter: 'Motion' };
    if (/matter/i.test(chapter)) return { subject: 'Chemistry', chapter: 'General' };
    if (/cell/i.test(chapter)) return { subject: 'Biology', chapter: 'General' };
  }
  if (subject === 'Maths') return { subject: 'Mathematics', chapter: 'General' };

  if (subject === 'SSC') {
    if (/french.*revolution/i.test(chapter)) return { subject: 'History', chapter: 'India' };
    if (/india.*size.*location/i.test(chapter)) return { subject: 'Geography', chapter: 'India' };
    if (/democracy/i.test(chapter)) return { subject: 'Civics', chapter: 'India' };
    if (/palampur/i.test(chapter)) return { subject: 'Economics', chapter: 'General' };
  }

  const passthrough = ['Physics', 'Mathematics', 'Chemistry', 'Biology', 'History', 'Geography', 'Civics', 'Economics'];
  if (passthrough.includes(subject)) {
    const subjectObj = QUIZ_BANK[subject];
    const firstChapter = subjectObj ? Object.keys(subjectObj)[0] : 'General';
    const chosenChapter = chapter && subjectObj?.[chapter] ? chapter : firstChapter;
    return { subject, chapter: chosenChapter };
  }

  return { subject: 'Physics', chapter: 'Motion' };
}

/** --------------------------
 *  QUIZ PAGE (save on Finish)
 *  -------------------------- */
export default function QuizPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();

  const rawSubject = params.get('subject') || '';
  const rawChapter = params.get('chapter') || '';
  const levelParam = (params.get('level') as Level) || 'Easy';

  const { subject, chapter } = normalizeSelection(rawSubject, rawChapter);
  const displayedChapter = rawChapter || chapter;
  const level: Level = levelParam;

  const preferredLang = normalizeLang(user?.language);
console.log('user.language =', user?.language);
console.log('preferredLang =', preferredLang);

  const baseQuestions = useMemo<Question[]>(() => {
    const subj = QUIZ_BANK[subject];
    const chap = subj?.[chapter];
    const arr = chap?.[level] || [];
    if (arr.length === 0 && chap) {
      return chap.Easy?.length ? chap.Easy! : chap.Medium?.length ? chap.Medium! : chap.Hard ?? [];
    }
    return arr;
  }, [subject, chapter, level]);

  const [questions, setQuestions] = useState<Question[]>(baseQuestions);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await preloadTranslationCache(preferredLang);
      const q = await translateQuestionsOnTheFly(baseQuestions, preferredLang);
      if (!cancelled) setQuestions(q);
    })();
    return () => { cancelled = true; };
  }, [baseQuestions, preferredLang]);

  // UI state
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const total = questions.length;

  const onSelect = (optIdx: number) => {
    const next = [...answers];
    next[index] = optIdx;
    setAnswers(next);
  };

  const progressPct = finished ? 100 : started && total > 0 ? (index / Math.max(total, 1)) * 100 : 0;

  const pageBg = 'bg-gradient-to-br from-[#E8D8FF] via-[#F1E9FF] to-[#D8C6FF]';
  const cardBg = 'bg-white/85 backdrop-blur-xl border border-white/60 shadow-2xl';

  const score = answers.reduce((acc, a, i) => acc + (a === (questions[i]?.correctIndex ?? -1) ? 1 : 0), 0);
  const scoreTitle =
    score === 5 ? 'Excellent' : score >= 3 ? 'Nice work' : 'Could do better';

  async function handleFinish() {
    setFinished(true);

    // "Saving" UX kept identical, but no DB call (no Firebase)
    if (!user?.uid || questions.length === 0) return;
    try {
      setSaving(true);
      setSaveError(null);

      // Create a local JSON file with studentId, subject, chapter, score, timestamp
      const result = {
        studentId: user.uid,
        subject,
        chapter: displayedChapter,
        score,
        timestamp: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz_score_${user.uid}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save your attempt.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`relative min-h-screen ${pageBg} text-gray-800 overflow-hidden`}>
      {/* Doodles */}
      <svg
        className="pointer-events-none absolute -top-16 -left-16 w-80 h-80 opacity-70 drop-shadow-[0_6px_12px_rgba(142,90,255,0.35)]"
        viewBox="0 0 220 220"
        fill="none"
      >
        <circle cx="70" cy="70" r="40" fill="#E2D4FF" />
        <rect x="120" y="28" width="70" height="44" rx="10" stroke="#BFA7FF" strokeWidth="4" fill="#F1E9FF" />
        <path d="M12 170 C50 120, 110 200, 170 150" stroke="#C6AEFF" strokeWidth="6" fill="none" />
        <path d="M165 82 l24 12 l-24 12 z" fill="#D9C6FF" />
        <g stroke="#B39DFF" strokeWidth="3">
          <line x1="26" y1="200" x2="54" y2="200" />
          <line x1="40" y1="186" x2="40" y2="214" />
        </g>
      </svg>

      <svg
        className="pointer-events-none absolute -bottom-24 -right-24 w-[30rem] h-[30rem] opacity-70 drop-shadow-[0_6px_12px_rgba(142,90,255,0.35)]"
        viewBox="0 0 300 300"
        fill="none"
      >
        <ellipse cx="190" cy="200" rx="85" ry="60" fill="#EFE4FF" />
        <path d="M38 70 L74 46 L110 70 L74 94 Z" fill="#E4D6FF" />
        <path d="M220 44 q22 12 0 24 q-22 12 0 24" stroke="#C9B7FF" strokeWidth="6" fill="none" />
        <g stroke="#BEA9FF" strokeWidth="3">
          <circle cx="250" cy="240" r="12" />
          <circle cx="272" cy="228" r="8" />
        </g>
        <path d="M120 230 L170 230" stroke="#C7B2FF" strokeWidth="6" />
      </svg>

      {/* Soft animated blobs */}
      <div className="pointer-events-none absolute -top-28 -left-20 w-80 h-80 bg-[#E5D6FF] rounded-full blur-3xl opacity-60 animate-pulse" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-96 h-96 bg-[#DCC9FF] rounded-full blur-3xl opacity-60 animate-pulse delay-700" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 w-72 h-72 bg-[#F0E7FF] rounded-full blur-3xl opacity-50 animate-pulse delay-1000" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className={`rounded-3xl ${cardBg} p-6 mb-6`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-[#6B5BBE]">Personalised Quiz</h1>
              <p className="text-sm text-[#5A4DA8]/90 mt-1">
                Subject: <span className="font-semibold">{rawSubject || subject}</span> • Chapter{' '}
                <span className="font-semibold">{displayedChapter}</span> • Level{' '}
                <span className="font-semibold">{level}</span>
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-[#6B5BBE]">
              <BookText className="h-6 w-6" />
              <span className="font-medium">Question-by-question view</span>
            </div>
          </div>
          <div className="w-full h-2 bg-[#E2D9FF] rounded-full mt-4 overflow-hidden">
            <div
              className="h-2 bg-gradient-to-r from-[#A689FF] to-[#7E61FF] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className={`rounded-3xl ${cardBg} p-8`}>
          {!started && !finished && (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#6B5BBE] mb-2">Ready to begin?</h2>
              <p className="text-[#5A4DA8]/90 mb-6">
                You’ll see one question at a time. Start with <b>Easy</b>. Use <i>Next</i> / <i>Previous</i> to navigate.
              </p>
              <Button
                className="bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] hover:brightness-110 text-white px-6 py-3 rounded-xl shadow-md"
                onClick={() => setStarted(true)}
                disabled={!questions.length}
              >
                Start
              </Button>
            </div>
          )}

          {started && !finished && questions.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-[#5A4DA8]/90">
                  Question <b>{index + 1}</b> of <b>{questions.length}</b>
                </span>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-[#F4EEFF] to-[#ECE2FF] p-6 border border-[#E1D3FF] relative overflow-hidden">
                <h3 className="text-xl font-semibold text-[#4E3FA3] mb-4">{questions[index].text}</h3>
                <ul className="space-y-3">
                  {questions[index].options.map((opt, i) => {
                    const selected = answers[index] === i;
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => onSelect(i)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition transform
                          ${
                            selected
                              ? 'border-[#9B87F5] ring-2 ring-[#B39DFF] bg-gradient-to-r from-white to-[#F3ECFF] shadow-md scale-[1.01]'
                              : 'border-[#E1D3FF] hover:border-[#C7B2FF] hover:bg-white/90 bg-white/80'
                          }`}
                        >
                          <span className={`font-medium ${selected ? 'text-[#6B5BBE]' : 'text-[#4E3FA3]/90'}`}>
                            {opt.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <Button
                  className={`bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-xl ${index === 0 ? 'opacity-0 pointer-events-none' : ''}`}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                  Previous
                </Button>

                {index < questions.length - 1 ? (
                  <Button
                    className="bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] hover:brightness-110 text-white rounded-xl"
                    onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    className="bg-gradient-to-r from-[#B179F1] to-[#FF8BD6] hover:brightness-110 text-white rounded-xl"
                    onClick={handleFinish}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Finish'}
                  </Button>
                )}
              </div>
            </>
          )}

          {finished && (
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-[#6B5BBE] mb-3">{scoreTitle} 🎉</h2>
              <p className="text-[#5A4DA8]/90 mb-6">
                Your score: <b>{score}</b> / {questions.length}
              </p>

              {saveError && (
                <p className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 inline-block">
                  {saveError}
                </p>
              )}

              <div className="text-left mx-auto max-w-xl bg-white/75 border border-white/70 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-[#4E3FA3] mb-3">Review</h3>
                <ul className="space-y-3">
                  {questions.map((q, i) => {
                    const correct = answers[i] === q.correctIndex;
                    return (
                      <li key={q.id} className="text-sm">
                        <div className="font-medium text-[#4E3FA3]/90">
                          Q{i + 1}. {q.text}
                        </div>
                        <div className={`${correct ? 'text-green-700' : 'text-rose-700'}`}>
                          Your answer{' '}
                          {answers[i] >= 0 ? q.options[answers[i]].value : <i>Not answered</i>}
                          {!correct && (
                            <>
                              {' '}| Correct{' '}
                              <span className="font-semibold">{q.options[q.correctIndex].value}</span>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  className="bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-xl"
                  onClick={() => {
                    setAnswers(Array(questions.length).fill(-1));
                    setIndex(0);
                    setStarted(false);
                    setFinished(false);
                    setSaveError(null);
                  }}
                >
                  Restart this quiz
                </Button>
                <Button
                  className="bg-gradient-to-r from-[#9B87F5] to-[#7C6BF2] text-white rounded-xl"
                  onClick={() => router.push('/student/lesson')}
                >
                  Back to AI Tutor
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
