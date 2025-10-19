'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BookText } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { preloadTranslationCache, translateQuestionsOnTheFly, normalizeLang } from '@/lib/translateQuizLite';

/** Firestore imports */
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** --------------------------
 *  TYPES
 *  -------------------------- */

type Option = { label: string; value: string };
type Question = {
  id: string;
  text: string;
  options: Option[];
  correctIndex: number; // 0-based
};
type Level = 'Easy';

type QuizBank = {
  [subject: string]: {
    [chapter: string]: {
      [level in Level]?: Question[];
    };
  };
};

// The i18n JSON in /public/quiz/* has Grade at the top level:
type Grade = '7' | '8' | '9';
type I18nBank = Record<Grade, QuizBank>;

/** --------------------------
 *  HELPERS
 *  -------------------------- */

const o = (arr: string[]): Option[] =>
  arr.map((v, i) => ({ label: String.fromCharCode(97 + i) + ') ' + v, value: v }));

function pickGradeFromString(raw: any): Grade | null {
  if (raw == null) return null;
  const s = String(raw).toLowerCase();
  const m = s.match(/(?:class|grade|std|standard)?\s*(7|8|9)\b/);
  if (m) return m[1] as Grade;
  if (/7th|\bvii\b|seven|saat/.test(s)) return '7';
  if (/8th|\bviii\b|eight|aath/.test(s)) return '8';
  if (/9th|\bix\b|nine|nau/.test(s)) return '9';
  return null;
}

function resolveUserGrade(user: any, params: URLSearchParams): Grade {
  // 1) Prefer URL query if present
  const qp =
    pickGradeFromString(params.get('class')) ||
    pickGradeFromString(params.get('grade')) ||
    pickGradeFromString(params.get('standard'));
  if (qp) return qp;

  // 2) Fall back to user object (cover common field names)
  const fromUser =
    pickGradeFromString(user?.className) ||
    pickGradeFromString(user?.class) ||
    pickGradeFromString(user?.grade) ||
    pickGradeFromString(user?.standard) ||
    pickGradeFromString(user?.studentClass);
  if (fromUser) return fromUser;

  // 3) Sensible default if nothing is provided
  return '9';
}

/** --------------------------
 *  QUESTION BANKS (by Class) — ENGLISH DEFAULTS
 *  -------------------------- */

/* -------------------- CLASS 7 -------------------- */
const QUIZ_BANK_7: QuizBank = {
  Science: {
    Magnets: {
      Easy: [
        { id: 'g7-sci-mag-1', text: 'Like poles of two magnets will:', options: o(['Attract', 'Repel', 'Neither attract nor repel', 'First attract then repel']), correctIndex: 1 },
        { id: 'g7-sci-mag-2', text: 'The ends of a bar magnet are called:', options: o(['Tips', 'Poles', 'Edges', 'Centers']), correctIndex: 1 },
        { id: 'g7-sci-mag-3', text: 'A freely suspended bar magnet points approximately towards:', options: o(['Geographic East–West', 'Geographic North–South', 'Sky', 'Ground']), correctIndex: 1 },
        { id: 'g7-sci-mag-4', text: 'Which is a natural magnet?', options: o(['Hematite', 'Magnetite (lodestone)', 'Galena', 'Bauxite']), correctIndex: 1 },
        { id: 'g7-sci-mag-5', text: 'Magnetic field is strongest at:', options: o(['Middle', 'Poles', 'Random points', 'Edges only']), correctIndex: 1 },
      ],
    },
    MethodsOfSeperation: {
      Easy: [
        { id: 'g7-sci-sep-1', text: 'Which method separates sand from water?', options: o(['Evaporation', 'Filtration', 'Distillation', 'Chromatography']), correctIndex: 1 },
        { id: 'g7-sci-sep-2', text: 'Evaporation is useful to obtain:', options: o(['Salt from salt solution', 'Oil from water', 'Iron filings from sand', 'Stones from rice']), correctIndex: 0 },
        { id: 'g7-sci-sep-3', text: 'Sieving is best for separating:', options: o(['Solids of different sizes', 'Liquids', 'Dissolved solids', 'Gases']), correctIndex: 0 },
        { id: 'g7-sci-sep-4', text: 'To separate cream from milk we use:', options: o(['Sedimentation', 'Centrifugation', 'Sublimation', 'Decantation']), correctIndex: 1 },
        { id: 'g7-sci-sep-5', text: 'Camphor can be separated from salt by:', options: o(['Sublimation', 'Filtration', 'Crystallisation', 'Magnetic separation']), correctIndex: 0 },
      ],
    },
    MindfulEating: {
      Easy: [
        { id: 'g7-sci-me-1', text: 'Balanced diet provides:', options: o(['Only carbohydrates', 'All nutrients in right amounts', 'Only proteins', 'Only fats']), correctIndex: 1 },
        { id: 'g7-sci-me-2', text: 'Excess junk food usually has:', options: o(['High vitamins and fibre', 'Low salt and sugar', 'High salt, sugar and fat', 'Only proteins']), correctIndex: 2 },
        { id: 'g7-sci-me-3', text: 'Mindful eating encourages:', options: o(['Eating very fast', 'Ignoring hunger cues', 'Noticing taste and fullness', 'Skipping breakfast']), correctIndex: 2 },
        { id: 'g7-sci-me-4', text: 'Fibre is mainly found in:', options: o(['Whole grains, fruits, vegetables', 'Butter and ghee', 'Meat only', 'Soft drinks']), correctIndex: 0 },
        { id: 'g7-sci-me-5', text: 'Dehydration is prevented by:', options: o(['More oily food', 'Adequate water intake', 'Skipping water', 'Only tea/coffee']), correctIndex: 1 },
      ],
    },
  },
  SSC: {
    Family: {
      Easy: [
        { id: 'g7-ssc-fam-1', text: 'A nuclear family usually consists of:', options: o(['Parents and children', 'Grandparents only', 'Cousins and neighbours', 'Only siblings']), correctIndex: 0 },
        { id: 'g7-ssc-fam-2', text: 'Shared responsibilities in a family help to build:', options: o(['Conflict', 'Cooperation', 'Isolation', 'Inequality']), correctIndex: 1 },
        { id: 'g7-ssc-fam-3', text: 'Respecting elders and caring for younger ones shows:', options: o(['Discipline', 'Family values', 'Punishment', 'Competition']), correctIndex: 1 },
        { id: 'g7-ssc-fam-4', text: 'A joint family includes:', options: o(['Only parents and one child', 'Extended relatives living together', 'Only friends', 'Only cousins separately']), correctIndex: 1 },
        { id: 'g7-ssc-fam-5', text: 'Household chores are best described as:', options: o(['Only women’s work', 'Shared tasks', 'Children’s work only', 'Men’s work only']), correctIndex: 1 },
      ],
    },
    OceansAndContinents: {
      Easy: [
        { id: 'g7-ssc-oc-1', text: 'The largest ocean is the:', options: o(['Indian', 'Arctic', 'Pacific', 'Atlantic']), correctIndex: 2 },
        { id: 'g7-ssc-oc-2', text: 'How many continents are generally recognised?', options: o(['5', '6', '7', '8']), correctIndex: 2 },
        { id: 'g7-ssc-oc-3', text: 'Africa is separated from Europe by the:', options: o(['Bering Strait', 'Strait of Gibraltar', 'English Channel', 'Palk Strait']), correctIndex: 1 },
        { id: 'g7-ssc-oc-4', text: 'The smallest ocean is the:', options: o(['Arctic', 'Indian', 'Atlantic', 'Pacific']), correctIndex: 0 },
        { id: 'g7-ssc-oc-5', text: 'Australia is also called the:', options: o(['Island Continent', 'Frozen Continent', 'Green Continent', 'Desert Continent']), correctIndex: 0 },
      ],
    },
    Timeline: {
      Easy: [
        { id: 'g7-ssc-time-1', text: 'A timeline helps us understand:', options: o(['Weather only', 'Sequence of events', 'Geography only', 'Mathematics only']), correctIndex: 1 },
        { id: 'g7-ssc-time-2', text: 'BC in a date means:', options: o(['Before Current', 'Before Christ', 'Binary Century', 'Between Centuries']), correctIndex: 1 },
        { id: 'g7-ssc-time-3', text: 'AD stands for:', options: o(['After Death', 'Anno Domini', 'Annual Date', 'After Decade']), correctIndex: 1 },
        { id: 'g7-ssc-time-4', text: 'Centuries are blocks of:', options: o(['10 years', '50 years', '100 years', '1000 years']), correctIndex: 2 },
        { id: 'g7-ssc-time-5', text: 'A chronological order lists events:', options: o(['Randomly', 'From latest to earliest', 'From earliest to latest', 'Alphabetically']), correctIndex: 2 },
      ],
    },
  },
  Mathematics: {
    DataHandling: {
      Easy: [
        { id: 'g7-math-dh-1', text: 'Mode of 2, 3, 3, 5 is:', options: o(['2', '3', '5', 'No mode']), correctIndex: 1 },
        { id: 'g7-math-dh-2', text: 'Mean of 4, 6, 10 is:', options: o(['6', '7', '8', '9']), correctIndex: 1 },
        { id: 'g7-math-dh-3', text: 'Median of 1, 2, 9 is:', options: o(['1', '2', '9', '3']), correctIndex: 1 },
        { id: 'g7-math-dh-4', text: 'A bar graph is useful for:', options: o(['Qualitative comparison by categories', 'Showing world maps', 'Angles only', '3D designs']), correctIndex: 0 },
        { id: 'g7-math-dh-5', text: 'Range of 2, 7, 11 is:', options: o(['9', '11', '7', '5']), correctIndex: 0 },
      ],
    },
    Symmetry: {
      Easy: [
        { id: 'g7-math-sym-1', text: 'A square has how many lines of symmetry?', options: o(['2', '3', '4', '8']), correctIndex: 3 },
        { id: 'g7-math-sym-2', text: 'A circle has:', options: o(['No line of symmetry', 'Exactly 2', 'Exactly 4', 'Infinite lines of symmetry']), correctIndex: 3 },
        { id: 'g7-math-sym-3', text: 'Reflection symmetry is also called:', options: o(['Rotational symmetry', 'Line symmetry', 'Point symmetry', 'No symmetry']), correctIndex: 1 },
        { id: 'g7-math-sym-4', text: 'An equilateral triangle has rotational symmetry of order:', options: o(['1', '2', '3', '6']), correctIndex: 2 },
        { id: 'g7-math-sym-5', text: 'A rectangle has how many lines of symmetry?', options: o(['2', '4', '1', '0']), correctIndex: 0 },
      ],
    },
    LinesAndAngles: {
      Easy: [
        { id: 'g7-math-la-1', text: 'Sum of angles on a straight line is:', options: o(['90°', '120°', '150°', '180°']), correctIndex: 3 },
        { id: 'g7-math-la-2', text: 'Vertically opposite angles are:', options: o(['Equal', 'Supplementary', 'Complementary', 'Unequal']), correctIndex: 0 },
        { id: 'g7-math-la-3', text: 'Angles less than 90° are called:', options: o(['Reflex', 'Obtuse', 'Acute', 'Straight']), correctIndex: 2 },
        { id: 'g7-math-la-4', text: 'If two lines never meet, they are:', options: o(['Intersecting', 'Parallel', 'Perpendicular', 'Skew']), correctIndex: 1 },
        { id: 'g7-math-la-5', text: 'A right angle equals:', options: o(['30°', '45°', '60°', '90°']), correctIndex: 3 },
      ],
    },
  },
};

/* -------------------- CLASS 8 -------------------- */
const QUIZ_BANK_8: QuizBank = {
  Science: {
    Electricity: {
      Easy: [
        { id: 'g8-sci-ele-1', text: 'SI unit of electric current is:', options: o(['Volt', 'Ohm', 'Ampere', 'Coulomb']), correctIndex: 2 },
        { id: 'g8-sci-ele-2', text: 'Device used to measure current:', options: o(['Voltmeter', 'Ammeter', 'Ohmmeter', 'Barometer']), correctIndex: 1 },
        { id: 'g8-sci-ele-3', text: 'A conductor allows:', options: o(['No charge flow', 'Easy charge flow', 'Only heat flow', 'Only light flow']), correctIndex: 1 },
        { id: 'g8-sci-ele-4', text: 'Resistance is measured in:', options: o(['Ampere', 'Volt', 'Ohm', 'Watt']), correctIndex: 2 },
        { id: 'g8-sci-ele-5', text: 'Electric fuse works on the principle of:', options: o(['Magnetism', 'Overheating/melting', 'Radiation', 'Cooling']), correctIndex: 1 },
      ],
    },
    LifeProcessesInPlants: {
      Easy: [
        { id: 'g8-sci-pl-1', text: 'Process by which plants make food:', options: o(['Respiration', 'Photosynthesis', 'Transpiration', 'Digestion']), correctIndex: 1 },
        { id: 'g8-sci-pl-2', text: 'Stomata are mainly for:', options: o(['Water absorption', 'Gas exchange', 'Transport of food', 'Seed formation']), correctIndex: 1 },
        { id: 'g8-sci-pl-3', text: 'Xylem transports:', options: o(['Food', 'Water and minerals', 'Hormones', 'Oxygen only']), correctIndex: 1 },
        { id: 'g8-sci-pl-4', text: 'The green pigment in leaves is:', options: o(['Chlorophyll', 'Haemoglobin', 'Melanin', 'Carotene']), correctIndex: 0 },
        { id: 'g8-sci-pl-5', text: 'Transpiration is:', options: o(['Loss of water vapour from leaves', 'Absorption of CO₂', 'Production of oxygen', 'Breakdown of glucose']), correctIndex: 0 },
      ],
    },
    LifeProcessesInAnimals: {
      Easy: [
        { id: 'g8-sci-an-1', text: 'The basic unit of life is the:', options: o(['Tissue', 'Organ', 'Cell', 'Organ system']), correctIndex: 2 },
        { id: 'g8-sci-an-2', text: 'In humans, oxygen is carried mainly by:', options: o(['Plasma', 'RBCs (haemoglobin)', 'WBCs', 'Platelets']), correctIndex: 1 },
        { id: 'g8-sci-an-3', text: 'Digestion begins in the:', options: o(['Stomach', 'Mouth', 'Small intestine', 'Large intestine']), correctIndex: 1 },
        { id: 'g8-sci-an-4', text: 'Excretion in humans is mainly carried out by:', options: o(['Lungs', 'Skin', 'Kidneys', 'Liver']), correctIndex: 2 },
        { id: 'g8-sci-an-5', text: 'The organ pumping blood throughout the body is the:', options: o(['Brain', 'Liver', 'Heart', 'Lungs']), correctIndex: 2 },
      ],
    },
  },
  SSC: {
    Empires: {
      Easy: [
        { id: 'g8-ssc-emp-1', text: 'An empire usually means:', options: o(['Small local rule', 'Large territory under one ruler', 'Democracy', 'City-state only']), correctIndex: 1 },
        { id: 'g8-ssc-emp-2', text: 'Capitals of empires were chosen for:', options: o(['Only beauty', 'Strategic, economic and political reasons', 'Random choice', 'Religious reasons only']), correctIndex: 1 },
        { id: 'g8-ssc-emp-3', text: 'Imperial administration maintains:', options: o(['Roads and trade', 'Only wars', 'Only temples', 'Only farms']), correctIndex: 0 },
        { id: 'g8-ssc-emp-4', text: 'Annexation expands an empire by:', options: o(['Diplomacy only', 'Adding territories', 'Reducing taxes only', 'Building schools']), correctIndex: 1 },
        { id: 'g8-ssc-emp-5', text: 'Sources to study empires include:', options: o(['Coins and inscriptions', 'Fossils only', 'Satellites only', 'Fiction only']), correctIndex: 0 },
      ],
    },
    GuptaEmpires: {
      Easy: [
        { id: 'g8-ssc-gupta-1', text: 'The Gupta period is often called the:', options: o(['Bronze Age', 'Golden Age of India', 'Stone Age', 'Industrial Age']), correctIndex: 1 },
        { id: 'g8-ssc-gupta-2', text: 'A famous Gupta ruler:', options: o(['Chandragupta II (Vikramaditya)', 'Ashoka', 'Harsha', 'Alauddin Khilji']), correctIndex: 0 },
        { id: 'g8-ssc-gupta-3', text: 'Famed university during Gupta period:', options: o(['Nalanda', 'Oxford', 'Takshashila in Europe', 'Beijing Univ.']), correctIndex: 0 },
        { id: 'g8-ssc-gupta-4', text: 'Gupta coins are important because they:', options: o(['Give climate data', 'Give political & economic information', 'Are only decorative', 'Show latitude and longitude']), correctIndex: 1 },
        { id: 'g8-ssc-gupta-5', text: 'Kalidasa lived during the:', options: o(['Mauryan period', 'Gupta period', 'Mughal period', 'Sultanate period']), correctIndex: 1 },
      ],
    },
    UnderstandingMarkets: {
      Easy: [
        { id: 'g8-ssc-mkt-1', text: 'A weekly market is typically:', options: o(['Permanent shops', 'Temporary stalls on a fixed day', 'Online only', 'Factory outlet']), correctIndex: 1 },
        { id: 'g8-ssc-mkt-2', text: 'Retailers buy from:', options: o(['Consumers', 'Wholesalers', 'Banks', 'Schools']), correctIndex: 1 },
        { id: 'g8-ssc-mkt-3', text: 'MRP on a product is the:', options: o(['Minimum retail price', 'Maximum retail price', 'Manufacturing rate price', 'Market rate percentile']), correctIndex: 1 },
        { id: 'g8-ssc-mkt-4', text: 'Fair trade encourages:', options: o(['Exploitation', 'Child labour', 'Ethical pricing to producers', 'Waste production']), correctIndex: 2 },
        { id: 'g8-ssc-mkt-5', text: 'Online marketplaces connect:', options: o(['Only producers', 'Only consumers', 'Producers and consumers digitally', 'Only transporters']), correctIndex: 2 },
      ],
    },
  },
  Mathematics: {
    ExpressionsUsingLetters: {
      Easy: [
        { id: 'g8-math-exp-1', text: 'In 3x + 5, x is a:', options: o(['Constant', 'Variable', 'Operator', 'Exponent']), correctIndex: 1 },
        { id: 'g8-math-exp-2', text: 'Simplify: 2x + 3x =', options: o(['5', '6x', '5x', 'x^5']), correctIndex: 2 },
        { id: 'g8-math-exp-3', text: 'Coefficient of y in 7y is:', options: o(['1', '7', 'y', '0']), correctIndex: 1 },
        { id: 'g8-math-exp-4', text: 'Value of 4a when a = 3 is:', options: o(['7', '12', '1/12', '43']), correctIndex: 1 },
        { id: 'g8-math-exp-5', text: 'Like terms are those with the same:', options: o(['Numerical value', 'Variables and powers', 'Signs only', 'Exponents only']), correctIndex: 1 },
      ],
    },
    Fractions: {
      Easy: [
        { id: 'g8-math-fr-1', text: '2/3 + 1/6 =', options: o(['1/2', '5/6', '2/9', '3/6']), correctIndex: 1 },
        { id: 'g8-math-fr-2', text: '3/4 of 20 is:', options: o(['5', '10', '15', '20']), correctIndex: 2 },
        { id: 'g8-math-fr-3', text: 'A fraction with numerator smaller than denominator is:', options: o(['Improper', 'Mixed', 'Proper', 'Whole']), correctIndex: 2 },
        { id: 'g8-math-fr-4', text: '0.25 equals:', options: o(['1/2', '1/3', '1/4', '1/5']), correctIndex: 2 },
        { id: 'g8-math-fr-5', text: 'Reciprocal of 5/8 is:', options: o(['5/8', '8/5', '−5/8', '5/−8']), correctIndex: 1 },
      ],
    },
    NumberPlay: {
      Easy: [
        { id: 'g8-math-np-1', text: 'A prime number has exactly:', options: o(['1 factor', '2 factors', '3 factors', '4 factors']), correctIndex: 1 },
        { id: 'g8-math-np-2', text: 'LCM of 6 and 8 is:', options: o(['12', '16', '24', '48']), correctIndex: 2 },
        { id: 'g8-math-np-3', text: 'HCF of 12 and 18 is:', options: o(['2', '3', '4', '6']), correctIndex: 3 },
        { id: 'g8-math-np-4', text: 'A multiple of 9 is divisible by the sum of its digits being:', options: o(['9', '8', '7', '6']), correctIndex: 0 },
        { id: 'g8-math-np-5', text: 'Even numbers are divisible by:', options: o(['3', '4', '2', '5']), correctIndex: 2 },
      ],
    },
  },
};

/* -------------------- CLASS 9 -------------------- */
const QUIZ_BANK_9: QuizBank = {
  Science: {
    Motion: {
      Easy: [
        { id: 'g9-sci-mot-1', text: 'The SI unit of velocity is:', options: o(['m/s²', 'm/s', 'km', 'm']), correctIndex: 1 },
        { id: 'g9-sci-mot-2', text: 'Area under a velocity–time graph represents:', options: o(['Acceleration', 'Displacement', 'Jerk', 'Power']), correctIndex: 1 },
        { id: 'g9-sci-mot-3', text: 'For uniform motion, acceleration is:', options: o(['Zero', 'Constant non-zero', 'Increasing', 'Decreasing']), correctIndex: 0 },
        { id: 'g9-sci-mot-4', text: 'For maximum range on level ground, angle of projection is:', options: o(['30°', '45°', '60°', '90°']), correctIndex: 1 },
        { id: 'g9-sci-mot-5', text: 'The path of a projectile (neglecting air resistance) is a:', options: o(['Circle', 'Straight line', 'Parabola', 'Ellipse']), correctIndex: 2 },
      ],
    },
    'Is Matter Around Us Pure': {
      Easy: [
        { id: 'g9-sci-pure-1', text: 'A solution is a _____ mixture.', options: o(['Heterogeneous', 'Homogeneous', 'Colloidal', 'Suspension']), correctIndex: 1 },
        { id: 'g9-sci-pure-2', text: 'The Tyndall effect is shown by:', options: o(['True solutions', 'Colloids', 'All mixtures', 'Pure substances']), correctIndex: 1 },
        { id: 'g9-sci-pure-3', text: 'Which method separates an insoluble solid from a liquid?', options: o(['Filtration', 'Evaporation', 'Distillation', 'Chromatography']), correctIndex: 0 },
        { id: 'g9-sci-pure-4', text: 'Distillation is best suited to separate:', options: o(['Sand and water', 'Oil and water', 'Alcohol and water (miscible liquids)', 'Iron filings and sulphur']), correctIndex: 2 },
        { id: 'g9-sci-pure-5', text: 'In a solution, the component present in larger amount is the:', options: o(['Solute', 'Solvent', 'Residue', 'Precipitate']), correctIndex: 1 },
      ],
    },
    'Cell Fundamental Unit of Life': {
      Easy: [
        { id: 'g9-sci-cell-1', text: 'The “powerhouse” of the cell is:', options: o(['Nucleus', 'Ribosome', 'Mitochondria', 'Chloroplast']), correctIndex: 2 },
        { id: 'g9-sci-cell-2', text: 'Cell wall is present in:', options: o(['Animal cells only', 'Plant cells only', 'Both plant and animal cells', 'Neither']), correctIndex: 1 },
        { id: 'g9-sci-cell-3', text: 'Ribosomes are the site of:', options: o(['Protein synthesis', 'Lipid synthesis', 'DNA replication', 'Photosynthesis']), correctIndex: 0 },
        { id: 'g9-sci-cell-4', text: 'Osmosis is:', options: o(['Diffusion of any gas', 'Movement of solute through a membrane', 'Movement of water through a semipermeable membrane', 'Bulk flow of liquid due to pressure']), correctIndex: 2 },
        { id: 'g9-sci-cell-5', text: 'Which organelle controls cell activities?', options: o(['Nucleus', 'Golgi apparatus', 'Lysosome', 'Vacuole']), correctIndex: 0 },
      ],
    },
  },
  SSC: {
    'French Revolution': {
      Easy: [
        { id: 'g9-ssc-fr-1', text: 'The Bastille was stormed on:', options: o(['14 July 1789', '26 January 1789', '4 July 1789', '5 May 1789']), correctIndex: 0 },
        { id: 'g9-ssc-fr-2', text: 'Before the Revolution, who paid most taxes?', options: o(['Clergy', 'Nobility', 'Commoners (Third Estate)', 'King']), correctIndex: 2 },
        { id: 'g9-ssc-fr-3', text: 'Leader associated with the Reign of Terror:', options: o(['Lafayette', 'Robespierre', 'Danton', 'Napoleon']), correctIndex: 1 },
        { id: 'g9-ssc-fr-4', text: 'The guillotine was used for:', options: o(['Measuring grain', 'Printing newspapers', 'Public executions', 'Minting coins']), correctIndex: 2 },
        { id: 'g9-ssc-fr-5', text: '“Declaration of the Rights of Man and Citizen” was adopted in:', options: o(['1787', '1788', '1789', '1791']), correctIndex: 2 },
      ],
    },
    'India Size and Location': {
      Easy: [
        { id: 'g9-ssc-size-1', text: 'India lies in which hemispheres?', options: o(['Northern & Western', 'Northern & Eastern', 'Southern & Eastern', 'Southern & Western']), correctIndex: 1 },
        { id: 'g9-ssc-size-2', text: 'The Standard Meridian of India is:', options: o(['82°30′ E', '75° E', '90° E', '70° E']), correctIndex: 0 },
        { id: 'g9-ssc-size-3', text: 'Which latitude roughly divides India into two equal parts?', options: o(['Equator', 'Tropic of Cancer', 'Tropic of Capricorn', 'Arctic Circle']), correctIndex: 1 },
        { id: 'g9-ssc-size-4', text: 'India is bounded by which ocean to the south?', options: o(['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean']), correctIndex: 2 },
        { id: 'g9-ssc-size-5', text: 'Sri Lanka is separated from India by the:', options: o(['Palk Strait and Gulf of Mannar', 'Malacca Strait', 'Hormuz Strait', 'Sunda Strait']), correctIndex: 0 },
      ],
    },
    'What is Democracy Why Democracy': {
      Easy: [
        { id: 'g9-ssc-dem-1', text: 'A key feature of democracy is:', options: o(['Hereditary rulers', 'Free and fair elections', 'No rule of law', 'No rights']), correctIndex: 1 },
        { id: 'g9-ssc-dem-2', text: 'In a democracy, final decision-making power rests with:', options: o(['Army', 'Hereditary monarch', 'Elected representatives', 'Religious heads']), correctIndex: 2 },
        { id: 'g9-ssc-dem-3', text: 'Universal adult franchise means:', options: o(['Only property owners vote', 'All adult citizens can vote', 'Only govt employees vote', 'Only men vote']), correctIndex: 1 },
        { id: 'g9-ssc-dem-4', text: 'A merit of democracy is that it:', options: o(['Ignores public opinion', 'Improves quality of decisions with debate', 'Encourages dictatorship', 'Prevents accountability']), correctIndex: 1 },
        { id: 'g9-ssc-dem-5', text: '“Government of the people, by the people, for the people” defines:', options: o(['Autocracy', 'Monarchy', 'Democracy', 'Oligarchy']), correctIndex: 2 },
      ],
    },
    'The Story of Village Palampur': {
      Easy: [
        { id: 'g9-ssc-pal-1', text: 'Main production activity in Palampur is:', options: o(['Farming', 'Mining', 'Shipbuilding', 'Tourism']), correctIndex: 0 },
        { id: 'g9-ssc-pal-2', text: 'Which is an example of fixed capital?', options: o(['Seeds', 'Fertilisers', 'Tractor', 'Wages']), correctIndex: 2 },
        { id: 'g9-ssc-pal-3', text: 'HYV seeds and modern inputs led to:', options: o(['Lower yields', 'Green Revolution', 'Less irrigation', 'Fewer crops per year']), correctIndex: 1 },
        { id: 'g9-ssc-pal-4', text: 'Human capital refers to:', options: o(['Tools and machines', 'Education, health and skills of people', 'Buildings', 'Raw materials']), correctIndex: 1 },
        { id: 'g9-ssc-pal-5', text: 'In Palampur, increased irrigation in the 1960s was mainly due to:', options: o(['Canals only', 'Electric tube-wells', 'Rainwater harvesting', 'Dams on rivers']), correctIndex: 1 },
      ],
    },
  },
  Mathematics: {
    'Number System': {
      Easy: [
        { id: 'g9-math-ns-1', text: 'Which of the following is an irrational number?', options: o(['√2', '1/3', '0.125', '−5']), correctIndex: 0 },
        { id: 'g9-math-ns-2', text: 'The decimal expansion of 1/8 is:', options: o(['0.125 (terminating)', '0.13 (non-terminating)', '0.333… (non-terminating)', '1.8 (terminating)']), correctIndex: 0 },
        { id: 'g9-math-ns-3', text: 'Which statement is true?', options: o(['Every rational number is an integer', 'Every integer is a rational number', 'Every irrational number is rational', 'All real numbers are natural numbers']), correctIndex: 1 },
        { id: 'g9-math-ns-4', text: 'Express 0.375 as a fraction in lowest terms:', options: o(['3/5', '3/8', '5/8', '7/8']), correctIndex: 1 },
        { id: 'g9-math-ns-5', text: 'A non-terminating, non-repeating decimal represents:', options: o(['A rational number', 'A natural number', 'An irrational number', 'An integer']), correctIndex: 2 },
      ],
    },
    Polynomials: {
      Easy: [
        { id: 'g9-math-poly-1', text: 'The degree of the polynomial 3x² − 5x + 7 is:', options: o(['0', '1', '2', '3']), correctIndex: 2 },
        { id: 'g9-math-poly-2', text: 'Zeros of x² − 9 are:', options: o(['3 and 9', '−3 and 3', '0 and 9', '−9 and 9']), correctIndex: 1 },
        { id: 'g9-math-poly-3', text: 'A linear polynomial has degree:', options: o(['0', '1', '2', '3']), correctIndex: 1 },
        { id: 'g9-math-poly-4', text: 'Factorise: x² + 7x + 12', options: o(['(x+2)(x+6)', '(x+3)(x+4)', '(x−3)(x−4)', '(x−2)(x−6)']), correctIndex: 1 },
        { id: 'g9-math-poly-5', text: 'A non-zero constant polynomial has how many zeros?', options: o(['0', '1', '2', 'Infinitely many']), correctIndex: 0 },
      ],
    },
    'Coordinate Geometry': {
      Easy: [
        { id: 'g9-math-cg-1', text: 'Coordinates of the origin are:', options: o(['(0, 1)', '(1, 0)', '(0, 0)', '(1, 1)']), correctIndex: 2 },
        { id: 'g9-math-cg-2', text: 'Point (−3, 4) lies in which quadrant?', options: o(['I', 'II', 'III', 'IV']), correctIndex: 1 },
        { id: 'g9-math-cg-3', text: 'Distance between (0, 0) and (3, 4) is:', options: o(['4', '5', '6', '7']), correctIndex: 1 },
        { id: 'g9-math-cg-4', text: 'The equation of the x-axis is:', options: o(['x = 0', 'y = 0', 'x = y', 'x + y = 0']), correctIndex: 1 },
        { id: 'g9-math-cg-5', text: 'A point on the y-axis has:', options: o(['x = 0', 'y = 0', 'x = y', 'x > 0']), correctIndex: 0 },
      ],
    },
  },
};

/* -------------------- MASTER MAP -------------------- */
const QUIZ_BANK_BY_CLASS: Record<Grade, QuizBank> = {
  '7': QUIZ_BANK_7,
  '8': QUIZ_BANK_8,
  '9': QUIZ_BANK_9,
};

/** --------------------------
 *  NORMALIZATION: Subject/Chapter per class
 *  -------------------------- */

function normalizeSelection(rawSubject: string, rawChapter: string, grade: Grade) {
  // subject normalization
  let subject = (rawSubject || '').trim();
  if (/^maths?$/i.test(subject)) subject = 'Mathematics';
  if (/^ss(c)?$/i.test(subject)) subject = 'SSC';
  if (/^sci(ence)?$/i.test(subject)) subject = 'Science';

  const bank = QUIZ_BANK_BY_CLASS[grade];
  if (!bank[subject]) {
    // If unknown subject, pick a default available one for this grade
    subject = Object.keys(bank)[0];
  }

  const chapters = Object.keys(bank[subject]);
  const wanted = (rawChapter || '').toLowerCase();

  // heuristic matches across spellings/spaces
  function pickChapter(): string {
    if (grade === '7') {
      if (/magnet/i.test(wanted)) return 'Magnets';
      if (/separat|seperat/i.test(wanted)) return 'MethodsOfSeperation';
      if (/mindful|eating/i.test(wanted)) return 'MindfulEating';
      if (subject === 'SSC') {
        if (/ocean|continent/i.test(wanted)) return 'OceansAndContinents';
        if (/timeline|time\s*line/i.test(wanted)) return 'Timeline';
        if (/family/i.test(wanted)) return 'Family';
      }
      if (subject === 'Mathematics') {
        if (/data.*handling/i.test(wanted)) return 'DataHandling';
        if (/symmetry/i.test(wanted)) return 'Symmetry';
        if (/lines?.*angles?/i.test(wanted)) return 'LinesAndAngles';
      }
    }

    if (grade === '8') {
      if (subject === 'Science') {
        if (/electric/i.test(wanted)) return 'Electricity';
        if (/life.*plant/i.test(wanted)) return 'LifeProcessesInPlants';
        if (/life.*animal/i.test(wanted)) return 'LifeProcessesInAnimals';
      }
      if (subject === 'SSC') {
        if (/gupta/i.test(wanted)) return 'GuptaEmpires';
        if (/empire/i.test(wanted)) return 'Empires';
        if (/market/i.test(wanted)) return 'UnderstandingMarkets';
      }
      if (subject === 'Mathematics') {
        if (/expression.*letter/i.test(wanted)) return 'ExpressionsUsingLetters';
        if (/fraction/i.test(wanted)) return 'Fractions';
        if (/number.*play/i.test(wanted)) return 'NumberPlay';
      }
    }

    if (grade === '9') {
      if (subject === 'Science') {
        if (/motion/i.test(wanted)) return 'Motion';
        if (/matter.*pure/i.test(wanted)) return 'Is Matter Around Us Pure';
        if (/fundamental.*unit.*life|cell/i.test(wanted)) return 'Cell Fundamental Unit of Life';
      }
      if (subject === 'SSC') {
        if (/french.*revolution/i.test(wanted)) return 'French Revolution';
        if (/size.*location/i.test(wanted)) return 'India Size and Location';
        if (/what.*democracy|why.*democracy/i.test(wanted)) return 'What is Democracy Why Democracy';
        if (/palampur/i.test(wanted)) return 'The Story of Village Palampur';
      }
      if (subject === 'Mathematics') {
        if (/number.*system/i.test(wanted)) return 'Number System';
        if (/polynomial/i.test(wanted)) return 'Polynomials';
        if (/coordinate.*geometry/i.test(wanted)) return 'Coordinate Geometry';
      }
    }

    // exact (case-insensitive) fallback
    const found = chapters.find((c) => c.toLowerCase() === wanted);
    return found || chapters[0];
  }

  const chapter = pickChapter();
  return { subject, chapter };
}

/** --------------------------
 *  QUIZ PAGE
 *  -------------------------- */
export default function QuizPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();

  const rawSubject = params.get('subject') || '';
  const rawChapter = params.get('chapter') || '';
  const levelParam = (params.get('level') as Level) || 'Easy';

  // **Language chosen on Lesson page**
  const chosenLangLabel = params.get('language') || ''; // e.g., "Hindi", "Marathi"...
  const selectedLang = normalizeLang(chosenLangLabel || user?.language); // normalize to code (hi, mr, bn, ta, en, pa, as)

  // Resolve grade from URL (if passed) or user profile (className/class/grade/standard/studentClass)
  const userGrade: Grade = resolveUserGrade(user, params);

  const { subject, chapter } = normalizeSelection(rawSubject, rawChapter, userGrade);
  const displayedChapter = rawChapter || chapter;
  const level: Level = levelParam;

  /** ---- Optional static i18n bank (currently only for Hindi) ---- */
  const [i18nBank, setI18nBank] = useState<I18nBank | null>(null);
  const [i18nError, setI18nError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function maybeLoadI18n() {
      setI18nError(null);
      setI18nBank(null);

      // Only load a static file for Hindi right now. On-the-fly is used for other languages.
      if (selectedLang !== 'hi') return;

      const filename = 'quiz_i18n_hi.json';
      const url = `/quiz/${filename}`; // served from public/quiz/filename

      try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
        const json = (await res.json()) as I18nBank;
        if (!cancelled) setI18nBank(json);
      } catch (e: any) {
        if (!cancelled) {
          setI18nError(e?.message || 'Unable to load Hindi quiz bank.');
          setI18nBank(null);
        }
      }
    }

    maybeLoadI18n();
    return () => {
      cancelled = true;
    };
  }, [selectedLang]);

  /** Choose base questions from either i18nBank (if available) or English defaults */
  const baseQuestions = useMemo<Question[]>(() => {
    const i18nForGrade = i18nBank?.[userGrade];
    const sourceBank = i18nForGrade ?? QUIZ_BANK_BY_CLASS[userGrade];

    const subj = sourceBank[subject];
    const chap = subj?.[chapter];
    const arr = chap?.[level] || [];
    if (arr.length === 0 && chap) {
      return chap.Easy?.length ? chap.Easy! : [];
    }
    return arr;
  }, [subject, chapter, level, userGrade, i18nBank]);

  const [questions, setQuestions] = useState<Question[]>(baseQuestions);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // If we have a static i18n bank (e.g., Hindi JSON), use it directly
      if (i18nBank) {
        if (!cancelled) setQuestions(baseQuestions);
        return;
      }

      // Otherwise translate from English defaults into the **selected language**
      await preloadTranslationCache(selectedLang);
      const q = await translateQuestionsOnTheFly(baseQuestions, selectedLang);
      if (!cancelled) setQuestions(q);
    })();
    return () => {
      cancelled = true;
    };
  }, [baseQuestions, selectedLang, i18nBank]);

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

    // Save to Firestore (fields: studentID, class, subject, chapter, score, timestamp)
    if (!user?.uid || questions.length === 0) return;
    try {
      setSaving(true);
      setSaveError(null);

      await addDoc(collection(db, 'quizAttempts'), {
        studentID: user.uid,
        class: userGrade,
        subject,
        chapter: displayedChapter,
        score,
        language: selectedLang, // (optional) keep a record of the quiz language
        timestamp: serverTimestamp(),
      });
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
              {i18nError && (
                <p className="text-xs text-rose-700 mt-1">
                  {i18nError}
                </p>
              )}
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
