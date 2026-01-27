import cfonts from 'cfonts'
import color from 'picocolors'
import { getVersion } from '../utils'

export const showHeader = () => {
  const header = cfonts.render('Kompo', {
    font: 'tiny', // define the font face
    align: 'left', // define text alignment
    colors: ['#394'], // define all colors
    background: 'transparent', // define the background color, you can also use `backgroundColor` here as key
    letterSpacing: 1, // define letter spacing
    lineHeight: 1, // define the line height
    space: false, // define if the output text should have empty lines on top and on the bottom
    maxLength: '0', // define how many character can be on one line
    gradient: false, // define your two gradient colors
    independentGradient: false, // define if you want to recalculate the gradient for each new line
    transitionGradient: false, // define if this is a transition between colors directly
    rawMode: false, // define if the line breaks should be CRLF (`\r\n`) over the default LF (`\n`)
    env: 'node', // define the environment cfonts is being executed in
  })

  if (!header || typeof header !== 'object' || !('string' in header)) {
    return ''
  }

  return (
    header.string +
    '\n' +
    color.bold(`Kompo v${getVersion()}`) +
    '\n' +
    color.dim('Press ESC or CTRL+C to exit') +
    '\n'
  )
}
