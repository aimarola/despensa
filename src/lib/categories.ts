import { normalize } from './format'

export interface Category {
  id: string
  name: string
  emoji: string
  color: string
  /** palabras que, si aparecen en el nombre del producto, sugieren esta categoría */
  words: string[]
  /** etiquetas de Open Food Facts (en:xxx) que llevan a esta categoría */
  off: string[]
}

/** En el orden típico de los pasillos de un supermercado español */
export const CATEGORIES: Category[] = [
  {
    id: 'fruta-verdura', name: 'Frutas y verduras', emoji: '🥬', color: '#3f9b4f',
    words: ['manzana', 'platano', 'pera', 'naranja', 'mandarina', 'limon', 'fresa', 'uva', 'melon', 'sandia', 'kiwi', 'pina', 'mango', 'aguacate', 'tomate', 'lechuga', 'cebolla', 'ajo', 'patata', 'zanahoria', 'pimiento', 'pepino', 'calabacin', 'berenjena', 'brocoli', 'espinaca', 'judia verde', 'champinon', 'seta', 'puerro', 'fruta', 'verdura', 'ensalada', 'perejil', 'cilantro', 'arandano', 'melocoton', 'cereza', 'calabaza', 'coliflor', 'alcachofa', 'canonigo', 'rucula'],
    off: ['en:fruits', 'en:fresh-fruits', 'en:vegetables', 'en:fresh-vegetables', 'en:salads', 'en:potatoes', 'en:mushrooms', 'en:herbs', 'en:plant-based-foods-and-beverages:fresh'],
  },
  {
    id: 'panaderia', name: 'Panadería y bollería', emoji: '🥖', color: '#c2833a',
    words: ['pan ', 'pan', 'barra', 'baguette', 'molde', 'tostado', 'picos', 'regaña', 'bolleria', 'croissant', 'magdalena', 'bizcocho', 'donut', 'napolitana', 'tortilla de trigo', 'wrap', 'pan rallado', 'hojaldre'],
    off: ['en:breads', 'en:sliced-breads', 'en:viennoiseries', 'en:pastries', 'en:cakes', 'en:muffins', 'en:breadcrumbs', 'en:flatbreads', 'en:tortillas'],
  },
  {
    id: 'carne', name: 'Carne', emoji: '🥩', color: '#c44536',
    words: ['pollo', 'pechuga', 'muslo', 'ternera', 'cerdo', 'lomo', 'filete', 'carne picada', 'hamburguesa', 'salchicha', 'chuleta', 'costilla', 'cordero', 'pavo', 'conejo', 'solomillo', 'albondiga', 'secreto', 'panceta'],
    off: ['en:meats', 'en:poultries', 'en:chickens', 'en:beef', 'en:pork', 'en:sausages', 'en:fresh-meats', 'en:burgers', 'en:meatballs'],
  },
  {
    id: 'pescado', name: 'Pescado y marisco', emoji: '🐟', color: '#2d7fb8',
    words: ['merluza', 'salmon', 'atun fresco', 'bacalao', 'dorada', 'lubina', 'gamba', 'langostino', 'mejillon', 'calamar', 'sepia', 'pulpo', 'boqueron', 'sardina', 'pescado', 'marisco', 'surimi', 'rape', 'almeja'],
    off: ['en:fishes', 'en:seafood', 'en:fish-and-meat-and-eggs:fish', 'en:shrimps', 'en:salmons', 'en:surimi'],
  },
  {
    id: 'charcuteria', name: 'Charcutería y quesos', emoji: '🧀', color: '#d9a21b',
    words: ['jamon', 'chorizo', 'salchichon', 'fuet', 'lomo embuchado', 'mortadela', 'pavo en lonchas', 'queso', 'bacon', 'sobrasada', 'morcilla', 'paté', 'pate'],
    off: ['en:cheeses', 'en:hams', 'en:cured-meats', 'en:prepared-meats', 'en:salamis', 'en:chorizos', 'en:bacon', 'en:pates', 'en:cold-cuts'],
  },
  {
    id: 'lacteos', name: 'Lácteos y huevos', emoji: '🥛', color: '#5aa0d6',
    words: ['leche', 'yogur', 'yogurt', 'kefir', 'nata', 'mantequilla', 'margarina', 'huevo', 'natillas', 'flan', 'cuajada', 'batido', 'requeson', 'bebida de avena', 'bebida de soja', 'bebida de almendra'],
    off: ['en:dairies', 'en:milks', 'en:yogurts', 'en:eggs', 'en:butters', 'en:creams', 'en:dairy-desserts', 'en:plant-based-milk-alternatives', 'en:fermented-milk-products'],
  },
  {
    id: 'despensa', name: 'Despensa', emoji: '🥫', color: '#8a6b4a',
    words: ['arroz', 'pasta', 'macarron', 'espagueti', 'fideo', 'lenteja', 'garbanzo', 'alubia', 'harina', 'azucar', 'sal', 'aceite', 'vinagre', 'tomate frito', 'atun', 'conserva', 'caldo', 'sopa', 'especia', 'pimienta', 'oregano', 'mayonesa', 'ketchup', 'mostaza', 'salsa', 'aceituna', 'legumbre', 'quinoa', 'cuscus', 'levadura', 'pure', 'maiz'],
    off: ['en:pastas', 'en:rices', 'en:legumes', 'en:canned-foods', 'en:sauces', 'en:oils', 'en:vinegars', 'en:flours', 'en:sugars', 'en:salts', 'en:condiments', 'en:spices', 'en:soups', 'en:canned-fishes', 'en:olives', 'en:groceries'],
  },
  {
    id: 'desayuno', name: 'Desayuno y dulces', emoji: '☕', color: '#7a4e2d',
    words: ['cafe', 'te ', 'infusion', 'cacao', 'colacao', 'nesquik', 'cereales', 'muesli', 'avena', 'galleta', 'mermelada', 'miel', 'chocolate', 'crema de cacao', 'nocilla', 'nutella', 'caramelo', 'chicle', 'turron', 'bombon'],
    off: ['en:breakfasts', 'en:breakfast-cereals', 'en:cereal-flakes', 'en:corn-flakes', 'en:extruded-cereals', 'en:mueslis', 'en:cereals-and-their-products', 'en:coffees', 'en:teas', 'en:cocoa-and-its-products', 'en:biscuits', 'en:biscuits-and-cakes', 'en:jams', 'en:honeys', 'en:chocolates', 'en:confectioneries', 'en:sweet-spreads', 'en:sweets'],
  },
  {
    id: 'snacks', name: 'Aperitivos', emoji: '🥨', color: '#e07a2f',
    words: ['patatas fritas', 'nachos', 'frutos secos', 'almendra', 'cacahuete', 'pipas', 'palomitas', 'snack', 'aperitivo', 'nueces', 'pistacho', 'anacardo', 'gusanito', 'cortezas'],
    off: ['en:salty-snacks', 'en:crisps', 'en:chips-and-fries', 'en:nuts', 'en:appetizers', 'en:popcorn', 'en:snacks', 'en:corn-chips'],
  },
  {
    id: 'congelados', name: 'Congelados', emoji: '🧊', color: '#4fb3c9',
    words: ['congelado', 'helado', 'pizza', 'croqueta', 'empanadilla', 'varitas', 'guisantes', 'hielo', 'lasaña', 'nugget', 'san jacobo'],
    off: ['en:frozen-foods', 'en:ice-creams', 'en:frozen-desserts', 'en:pizzas', 'en:frozen-vegetables', 'en:frozen-fishes'],
  },
  {
    id: 'bebidas', name: 'Bebidas', emoji: '🥤', color: '#d64f7d',
    words: ['agua', 'refresco', 'coca cola', 'cola', 'fanta', 'zumo', 'cerveza', 'vino', 'cava', 'tinto', 'gaseosa', 'tonica', 'nestea', 'aquarius', 'isotonica', 'licor', 'sidra', 'kombucha'],
    off: ['en:beverages', 'en:waters', 'en:sodas', 'en:juices', 'en:fruit-juices', 'en:beers', 'en:wines', 'en:alcoholic-beverages', 'en:carbonated-drinks', 'en:soft-drinks', 'en:iced-teas', 'en:energy-drinks'],
  },
  {
    id: 'limpieza', name: 'Limpieza y hogar', emoji: '🧽', color: '#6c63c7',
    words: ['detergente', 'suavizante', 'lejia', 'friegasuelos', 'lavavajillas', 'fairy', 'jabon de ropa', 'limpiador', 'estropajo', 'bayeta', 'fregona', 'papel de cocina', 'papel higienico', 'servilleta', 'bolsa de basura', 'ambientador', 'insecticida', 'papel de aluminio', 'film', 'pastilla lavavajillas', 'quitagrasas', 'limpiacristales', 'pila', 'bombilla'],
    off: ['en:cleaning-products', 'en:household-products', 'en:detergents', 'en:dishwashing-products', 'en:laundry'],
  },
  {
    id: 'higiene', name: 'Higiene y cuidado', emoji: '🧴', color: '#cf6fae',
    words: ['champu', 'gel', 'jabon de manos', 'desodorante', 'pasta de dientes', 'dentifrico', 'cepillo de dientes', 'colutorio', 'crema', 'compresa', 'tampon', 'cuchilla', 'maquinilla', 'algodon', 'bastoncillo', 'acondicionador', 'protector solar', 'toallita', 'pañuelo', 'panuelo', 'colonia', 'laca', 'tinte'],
    off: ['en:cosmetics', 'en:shampoos', 'en:shower-gels', 'en:toothpastes', 'en:deodorants', 'en:hygiene'],
  },
  {
    id: 'bebe', name: 'Bebé', emoji: '🍼', color: '#f2a65a',
    words: ['pañal', 'panal', 'potito', 'papilla', 'leche de continuacion', 'toallitas bebe', 'biberon'],
    off: ['en:baby-foods', 'en:baby-milks', 'en:diapers'],
  },
  {
    id: 'mascotas', name: 'Mascotas', emoji: '🐾', color: '#9a7b5f',
    words: ['pienso', 'comida de perro', 'comida de gato', 'arena gato', 'snack perro', 'perro', 'gato'],
    off: ['en:pet-food', 'en:dog-food', 'en:cat-food'],
  },
  { id: 'otros', name: 'Otros', emoji: '📦', color: '#8a948f', words: [], off: [] },
]

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]))
export const CATEGORY_ORDER = new Map(CATEGORIES.map((c, i) => [c.id, i]))

export function categoryOf(id: string | null | undefined): Category {
  return CATEGORY_BY_ID.get(id ?? '') ?? CATEGORY_BY_ID.get('otros')!
}

/** Sugiere categoría a partir del nombre que escribe la familia */
export function guessCategoryFromName(name: string): string | null {
  const n = ` ${normalize(name)} `
  // En español lo importante va primero ("Pizza 4 quesos" es pizza, no queso):
  // gana la palabra que aparece antes y, a igualdad, la más larga.
  let best: { id: string; pos: number; len: number } | null = null
  for (const c of CATEGORIES) {
    for (const w of c.words) {
      const nw = normalize(w)
      if (!nw) continue
      const pos = n.indexOf(nw.length <= 3 ? ` ${nw} ` : nw)
      if (pos < 0) continue
      if (!best || pos < best.pos || (pos === best.pos && nw.length > best.len)) best = { id: c.id, pos, len: nw.length }
    }
  }
  return best?.id ?? null
}

/** Traduce las categorías de Open Food Facts a las nuestras (la más específica gana) */
export function categoryFromOff(tags: string[] | undefined, source: 'food' | 'products' | 'beauty'): string | null {
  if (source === 'beauty') return 'higiene'
  if (source === 'products') return 'limpieza'
  if (!tags?.length) return null
  for (let i = tags.length - 1; i >= 0; i--) {
    const t = tags[i]
    for (const c of CATEGORIES) if (c.off.includes(t)) return c.id
  }
  // Coincidencia parcial (p.ej. en:squeezed-orange-juices → zumos → bebidas)
  for (let i = tags.length - 1; i >= 0; i--) {
    const t = tags[i]
    for (const c of CATEGORIES) if (c.off.some((o) => t.includes(o.replace('en:', '').replace(/s$/, '')))) return c.id
  }
  return null
}
