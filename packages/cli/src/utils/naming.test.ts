import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ALIAS,
  getAdapterFactoryName,
  getDriverPackageName,
  getInfraDirName,
  getInfraPackageName,
} from './naming'

describe('naming utils', () => {
  describe('getAdapterFactoryName', () => {
    it('should generate base factory name without alias', () => {
      expect(getAdapterFactoryName('nft-http-client-axios')).toBe('createNftHttpClientAxiosAdapter')
    })

    it(`should generate base factory name with "${DEFAULT_ALIAS}" alias`, () => {
      expect(getAdapterFactoryName('nft-http-client-axios', DEFAULT_ALIAS)).toBe(
        'createNftHttpClientAxiosAdapter'
      )
    })

    it('should generate specialized factory name with alias', () => {
      expect(getAdapterFactoryName('nft-http-client-axios', 'coingecko')).toBe(
        'createNftHttpClientAxiosCoingeckoAdapter'
      )
    })

    it('should handle hyphenated alias correctly', () => {
      expect(getAdapterFactoryName('nft-http-client-axios', 'my-api')).toBe(
        'createNftHttpClientAxiosMyApiAdapter'
      )
    })
  })

  describe('getInfraDirName', () => {
    it('should generate infra dir name with subject and alias', () => {
      expect(getInfraDirName('database', DEFAULT_ALIAS)).toBe(`database-${DEFAULT_ALIAS}`)
      expect(getInfraDirName('http', 'stripe')).toBe('http-stripe')
    })

    it('should throw if subject is missing', () => {
      expect(() => getInfraDirName('', DEFAULT_ALIAS)).toThrow()
    })
  })

  describe('getInfraPackageName', () => {
    it('should generate full infra package name', () => {
      expect(getInfraPackageName('org', 'database', DEFAULT_ALIAS)).toBe(
        `@org/infra-database-${DEFAULT_ALIAS}`
      )
    })
  })

  describe('getDriverPackageName', () => {
    it('should generate full driver package name', () => {
      expect(getDriverPackageName('org', 'http-axios')).toBe('@org/driver-http-axios')
    })
  })
})
