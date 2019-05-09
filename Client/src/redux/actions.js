/*
 * action types
 */

export const TEST = 'TEST'

/*
 * action creators
 */

export function testMethod(test)
{
  return { type: TEST, test }
}