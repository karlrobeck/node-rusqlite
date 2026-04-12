import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { Connection, DbConfig } from "../bindings/binding"

describe("Connection - Configuration", () => {
  let conn: Connection

  beforeEach(() => {
    conn = Connection.openInMemory()
  })

  afterEach(() => {
    try {
      // Force finalization of pending statements
      conn.execute("PRAGMA integrity_check", [])
      conn.cacheFlush()
    } catch (e) {
      // Ignore errors during cleanup
    }
  })


  describe("connection.dbConfig()", () => {
    it("should read database config flag", () => {
      expect(() => {
        conn.dbConfig(DbConfig.SqliteDbconfigEnableFkey)
      }).not.toThrow()
    })

    it("should handle various DbConfig options", () => {
      const configs = [
        DbConfig.SqliteDbconfigEnableFkey,
        DbConfig.SqliteDbconfigEnableTrigger,
        DbConfig.SqliteDbconfigDefensive,
      ]

      for (const config of configs) {
        expect(() => {
          conn.dbConfig(config)
        }).not.toThrow()
      }
    })
  })

  describe("connection.setDbConfig()", () => {
    it("should set config flag to true", () => {
      expect(() => {
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true)
      }).not.toThrow()
    })

    it("should set config flag to false", () => {
      expect(() => {
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, false)
      }).not.toThrow()
    })

    it("should handle enabling foreign keys", () => {
      expect(() => {
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true)
      }).not.toThrow()
    })

    it("should handle disabling foreign keys", () => {
      expect(() => {
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, false)
      }).not.toThrow()
    })

    it("should handle enabling triggers", () => {
      expect(() => {
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableTrigger, true)
      }).not.toThrow()
    })

    it("should handle enabling defensive mode", () => {
      expect(() => {
        conn.setDbConfig(DbConfig.SqliteDbconfigDefensive, true)
      }).not.toThrow()
    })

    it("should handle enabling FTS3 tokenizer", () => {
      expect(() => {
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableFts3Tokenizer, true)
      }).not.toThrow()
    })

    it("should handle enabling QPSG", () => {
      expect(() => {
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableQpsg, true)
      }).not.toThrow()
    })

    it("should handle multiple config changes", () => {
      expect(() => {
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true)
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableTrigger, true)
        conn.setDbConfig(DbConfig.SqliteDbconfigDefensive, true)
      }).not.toThrow()
    })

    it("should handle config changes with boolean toggling", () => {
      expect(() => {
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true)
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, false)
        conn.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true)
      }).not.toThrow()
    })
  })

  describe("DbConfig Enum", () => {
    it("should have standard config options", () => {
      expect(DbConfig.SqliteDbconfigEnableFkey).toBeDefined()
      expect(DbConfig.SqliteDbconfigEnableTrigger).toBeDefined()
      expect(DbConfig.SqliteDbconfigDefensive).toBeDefined()
    })

    it("should have numeric values", () => {
      expect(typeof DbConfig.SqliteDbconfigEnableFkey).toBe("number")
      expect(typeof DbConfig.SqliteDbconfigEnableTrigger).toBe("number")
    })

    it("should have distinct values", () => {
      expect(DbConfig.SqliteDbconfigEnableFkey).not.toBe(DbConfig.SqliteDbconfigEnableTrigger)
    })

    it("should support all documented options", () => {
      const options = [
        DbConfig.SqliteDbconfigEnableFkey,
        DbConfig.SqliteDbconfigEnableTrigger,
        DbConfig.SqliteDbconfigEnableFts3Tokenizer,
        DbConfig.SqliteDbconfigNoCkptOnClose,
        DbConfig.SqliteDbconfigEnableQpsg,
        DbConfig.SqliteDbconfigTriggerEqp,
        DbConfig.SqliteDbconfigResetDatabase,
        DbConfig.SqliteDbconfigDefensive,
        DbConfig.SqliteDbconfigWritableSchema,
        DbConfig.SqliteDbconfigLegacyAlterTable,
        DbConfig.SqliteDbconfigDqsDml,
        DbConfig.SqliteDbconfigDqsDdl,
        DbConfig.SqliteDbconfigEnableView,
        DbConfig.SqliteDbconfigLegacyFileFormat,
        DbConfig.SqliteDbconfigTrustedSchema,
        DbConfig.SqliteDbconfigStmtScanStatus,
        DbConfig.SqliteDbconfigReverseScanOrder,
        DbConfig.SqliteDbconfigEnableAttachCreate,
        DbConfig.SqliteDbconfigEnableAttachWrite,
        DbConfig.SqliteDbconfigEnableComments,
      ]

      for (const option of options) {
        expect(typeof option).toBe("number")
      }
    })
  })
})
