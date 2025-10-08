export const ROOMS = [
  { id: 'kitchen', name: 'Kitchen', icon: '🍳' },
  { id: 'bathroom', name: 'Bathroom', icon: '🛁' },
  { id: 'bedroom', name: 'Bedroom', icon: '🛏️' },
  { id: 'living-room', name: 'Living Room', icon: '🛋️' },
  { id: 'dining-room', name: 'Dining Room', icon: '🍽️' },
  { id: 'office', name: 'Office', icon: '💼' }
];

export const PHOTO_MODES = {
  BEFORE: 'before',
  AFTER: 'after',
  COMBINED: 'mix'
};

export const TEMPLATE_TYPES = {
  STACK_PORTRAIT: 'stack-portrait',         // 9:16 portrait, stacked
  STACK_LANDSCAPE: 'stack-landscape',       // 16:9 landscape, stacked
  SIDE_BY_SIDE_LANDSCAPE: 'sidebyside-landscape', // 16:9 landscape, side-by-side
  SIDE_BY_SIDE_WIDE: 'sidebyside-wide',     // 2:1 extra wide, side-by-side
  SQUARE_STACK: 'square-stack',             // 1:1 square, stacked
  SQUARE_SIDE: 'square-sidebyside',         // 1:1 square, side-by-side
  BLOG_FORMAT: 'blog-16-9'                  // 16:9 blog format, side-by-side
};

export const TEMPLATE_CONFIGS = {
  [TEMPLATE_TYPES.STACK_PORTRAIT]: {
    name: 'Portrait (9:16)',
    width: 1080,
    height: 1920,
    layout: 'stack'
  },
  [TEMPLATE_TYPES.STACK_LANDSCAPE]: {
    name: 'Landscape (16:9)',
    width: 1920,
    height: 1080,
    layout: 'stack'
  },
  [TEMPLATE_TYPES.SIDE_BY_SIDE_LANDSCAPE]: {
    name: 'Side-by-Side (16:9)',
    width: 1920,
    height: 1080,
    layout: 'sidebyside'
  },
  [TEMPLATE_TYPES.SIDE_BY_SIDE_WIDE]: {
    name: 'Wide (2:1)',
    width: 2000,
    height: 1000,
    layout: 'sidebyside'
  },
  [TEMPLATE_TYPES.SQUARE_STACK]: {
    name: 'Square Stack (1:1)',
    width: 1080,
    height: 1080,
    layout: 'stack'
  },
  [TEMPLATE_TYPES.SQUARE_SIDE]: {
    name: 'Square Side (1:1)',
    width: 1080,
    height: 1080,
    layout: 'sidebyside'
  },
  [TEMPLATE_TYPES.BLOG_FORMAT]: {
    name: 'Blog (16:9)',
    width: 1920,
    height: 1080,
    layout: 'sidebyside'
  }
};

export const COLORS = {
  PRIMARY: '#F2C31B',
  BACKGROUND: '#f8fafc',
  TEXT: '#303030',
  BORDER: '#E1E1E1',
  GRAY: '#B3B3B3'
};
