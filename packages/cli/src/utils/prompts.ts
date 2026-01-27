import { cancel, isCancel, select } from '@clack/prompts'

export interface NavigationOption<T> {
  label: string
  value: T
  hint?: string
}

export interface NavigationCategory<T> {
  label: string
  value: string
  hint?: string
  submenuMessage?: string
  options: NavigationOption<T>[]
}

/**
 * Interactive prompt that lets users select a category and then an option,
 * with support for navigating back to the category list.
 */
export async function selectWithNavigation<T extends string>(
  categoryMessage: string,
  categories: NavigationCategory<T>[]
): Promise<T> {
  while (true) {
    // 1. Select Category
    const categoryValue = await select({
      message: categoryMessage,
      options: categories.map((c) => ({
        label: c.label,
        value: c.value,
        hint: c.hint,
      })) as any,
    })

    if (isCancel(categoryValue)) {
      cancel('Cancelled')
      process.exit(0)
    }

    const selectedCategory = categories.find((c) => c.value === categoryValue)
    if (!selectedCategory) continue

    // Clear console to allow the submenu to "replace" the category prompt
    process.stdout.write('\x1Bc')

    // 2. Select Option within Category
    const optionValue = await select({
      message: selectedCategory.submenuMessage || `Select ${selectedCategory.label}`,
      options: [
        { label: '← Back', value: 'BACK', hint: 'Return to previous menu' },
        ...selectedCategory.options,
      ] as any,
    })

    if (isCancel(optionValue)) {
      cancel('Cancelled')
      process.exit(0)
    }

    if (optionValue === 'BACK') {
      // Clear console to prevent clutter
      process.stdout.write('\x1Bc')
      continue
    }

    return optionValue as T
  }
}
