import { describe, expect, it } from "vitest"
import {
  isValidQuebecPhone,
  normalizePhone,
  formatPhoneForDisplay,
} from "../../lib/phone"

describe("isValidQuebecPhone", () => {
  it.each([
    "514-555-1234",
    "(514) 555-1234",
    "514.555.1234",
    "5145551234",
    "514 555 1234",
    "1 514 555 1234",
    "+1 514 555 1234",
    "+1 (514) 555-1234",
    "+15145551234",
    "1-514-555-1234",
    "1(514)555-1234",
    "  514-555-1234  ",
    "418-555-9999",
    "450-555-0000",
    "438-555-1111",
    "579-555-2222",
    "873-555-3333",
    "367-555-4444",
    "263-555-5555",
  ])("accepts valid Quebec/NANP number: %s", (input) => {
    expect(isValidQuebecPhone(input)).toBe(true)
  })

  it.each([
    "",
    " ",
    "abc",
    "514-555-12",
    "514-555-12345",
    "0145551234",
    "1145551234",
    "514-055-1234",
    "514-155-1234",
    "555-1234",
    "+33 1 23 45 67 89",
    "514-CALL-NOW",
    "0000000000",
    "1111111111",
    null as unknown as string,
    undefined as unknown as string,
    123 as unknown as string,
  ])("rejects invalid input: %s", (input) => {
    expect(isValidQuebecPhone(input)).toBe(false)
  })
})

describe("normalizePhone", () => {
  it.each([
    ["514-555-1234", "+15145551234"],
    ["(514) 555-1234", "+15145551234"],
    ["+1 514 555 1234", "+15145551234"],
    ["5145551234", "+15145551234"],
    ["1.514.555.1234", "+15145551234"],
    ["  514 555 1234  ", "+15145551234"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it("returns null for invalid input", () => {
    expect(normalizePhone("123")).toBeNull()
    expect(normalizePhone("")).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })
})

describe("formatPhoneForDisplay", () => {
  it("formats a valid number", () => {
    expect(formatPhoneForDisplay("5145551234")).toBe("(514) 555-1234")
    expect(formatPhoneForDisplay("+15145551234")).toBe("(514) 555-1234")
  })

  it("returns input unchanged when invalid", () => {
    expect(formatPhoneForDisplay("garbage")).toBe("garbage")
  })
})
