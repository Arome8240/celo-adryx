import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress, keccak256, parseEther, toBytes, zeroAddress } from "viem";

const DEPOSIT_AMOUNT = parseEther("100");
const BOOKING_HASH_1 = keccak256(toBytes("booking-1"));
const BOOKING_HASH_2 = keccak256(toBytes("booking-2"));
const BOOKING_HASH_3 = keccak256(toBytes("booking-3"));

// Escrow.Status enum order, mirrored from the contract.
const STATUS_DEPOSITED = 1;
const STATUS_RELEASED = 2;
const STATUS_REFUNDED = 3;

describe("FlightEscrow", function () {
  async function deployFixture() {
    const [admin, operator, payer, treasury, attacker] =
      await hre.viem.getWalletClients();

    const token = await hre.viem.deployContract("MockERC20", [
      "Mock USDm",
      "mUSDm",
    ]);
    await token.write.mint([payer.account.address, DEPOSIT_AMOUNT * 10n]);

    const escrow = await hre.viem.deployContract("FlightEscrow", [
      token.address,
      treasury.account.address,
      admin.account.address,
      operator.account.address,
    ]);

    const tokenAsPayer = await hre.viem.getContractAt(
      "MockERC20",
      token.address,
      { client: { wallet: payer } },
    );
    const escrowAsPayer = await hre.viem.getContractAt(
      "FlightEscrow",
      escrow.address,
      { client: { wallet: payer } },
    );
    const escrowAsOperator = await hre.viem.getContractAt(
      "FlightEscrow",
      escrow.address,
      { client: { wallet: operator } },
    );
    const escrowAsAdmin = await hre.viem.getContractAt(
      "FlightEscrow",
      escrow.address,
      { client: { wallet: admin } },
    );
    const escrowAsAttacker = await hre.viem.getContractAt(
      "FlightEscrow",
      escrow.address,
      { client: { wallet: attacker } },
    );

    return {
      token,
      escrow,
      admin,
      operator,
      payer,
      treasury,
      attacker,
      tokenAsPayer,
      escrowAsPayer,
      escrowAsOperator,
      escrowAsAdmin,
      escrowAsAttacker,
    };
  }

  async function depositedFixture() {
    const ctx = await deployFixture();
    await ctx.tokenAsPayer.write.approve([ctx.escrow.address, DEPOSIT_AMOUNT]);
    await ctx.escrowAsPayer.write.deposit([BOOKING_HASH_1, DEPOSIT_AMOUNT]);
    return ctx;
  }

  async function depositedNativeFixture() {
    const ctx = await deployFixture();
    await ctx.escrowAsPayer.write.depositNative([BOOKING_HASH_1], {
      value: DEPOSIT_AMOUNT,
    });
    return ctx;
  }

  describe("Deployment", function () {
    it("sets the token, treasury, and roles", async function () {
      const { escrow, token, treasury, admin, operator } =
        await loadFixture(deployFixture);

      expect(await escrow.read.token()).to.equal(getAddress(token.address));
      expect(await escrow.read.treasury()).to.equal(
        getAddress(treasury.account.address),
      );

      const adminRole = await escrow.read.DEFAULT_ADMIN_ROLE();
      const operatorRole = await escrow.read.OPERATOR_ROLE();
      expect(await escrow.read.hasRole([adminRole, admin.account.address])).to
        .be.true;
      expect(
        await escrow.read.hasRole([operatorRole, operator.account.address]),
      ).to.be.true;
      expect(await escrow.read.hasRole([operatorRole, admin.account.address]))
        .to.be.false;
    });

    it("rejects a zero-address token", async function () {
      const { treasury, admin, operator } = await loadFixture(deployFixture);
      await expect(
        hre.viem.deployContract("FlightEscrow", [
          zeroAddress,
          treasury.account.address,
          admin.account.address,
          operator.account.address,
        ]),
      ).to.be.rejected;
    });

    it("rejects a zero-address treasury", async function () {
      const { token, admin, operator } = await loadFixture(deployFixture);
      await expect(
        hre.viem.deployContract("FlightEscrow", [
          token.address,
          zeroAddress,
          admin.account.address,
          operator.account.address,
        ]),
      ).to.be.rejected;
    });

    it("rejects a zero-address admin", async function () {
      const { token, treasury, operator } = await loadFixture(deployFixture);
      await expect(
        hre.viem.deployContract("FlightEscrow", [
          token.address,
          treasury.account.address,
          zeroAddress,
          operator.account.address,
        ]),
      ).to.be.rejected;
    });

    it("rejects a zero-address operator", async function () {
      const { token, treasury, admin } = await loadFixture(deployFixture);
      await expect(
        hre.viem.deployContract("FlightEscrow", [
          token.address,
          treasury.account.address,
          admin.account.address,
          zeroAddress,
        ]),
      ).to.be.rejected;
    });
  });

  describe("deposit", function () {
    it("pulls tokens into escrow and records the deposit", async function () {
      const { escrowAsPayer, tokenAsPayer, escrow, token, payer } =
        await loadFixture(deployFixture);

      await tokenAsPayer.write.approve([escrow.address, DEPOSIT_AMOUNT]);
      await escrowAsPayer.write.deposit([BOOKING_HASH_1, DEPOSIT_AMOUNT]);

      const [storedPayer, amount, status] = await escrow.read.escrows([
        BOOKING_HASH_1,
      ]);
      expect(getAddress(storedPayer)).to.equal(
        getAddress(payer.account.address),
      );
      expect(amount).to.equal(DEPOSIT_AMOUNT);
      expect(status).to.equal(STATUS_DEPOSITED);
      expect(await token.read.balanceOf([escrow.address])).to.equal(
        DEPOSIT_AMOUNT,
      );
    });

    it("rejects a second deposit for the same bookingIdHash", async function () {
      const { escrowAsPayer, tokenAsPayer, escrow } =
        await loadFixture(depositedFixture);

      await tokenAsPayer.write.approve([escrow.address, DEPOSIT_AMOUNT]);
      await expect(
        escrowAsPayer.write.deposit([BOOKING_HASH_1, DEPOSIT_AMOUNT]),
      ).to.be.rejectedWith("FlightEscrow: already deposited");
    });

    it("rejects a zero amount", async function () {
      const { escrowAsPayer } = await loadFixture(deployFixture);
      await expect(
        escrowAsPayer.write.deposit([BOOKING_HASH_1, 0n]),
      ).to.be.rejectedWith("FlightEscrow: amount is zero");
    });

    it("reverts if the payer never approved the contract", async function () {
      const { escrowAsPayer } = await loadFixture(deployFixture);
      await expect(
        escrowAsPayer.write.deposit([BOOKING_HASH_1, DEPOSIT_AMOUNT]),
      ).to.be.rejected;
    });
  });

  describe("release", function () {
    it("moves funds to the treasury and marks the escrow released", async function () {
      const { escrowAsOperator, token, treasury, escrow } =
        await loadFixture(depositedFixture);

      await escrowAsOperator.write.release([BOOKING_HASH_1]);

      expect(await token.read.balanceOf([treasury.account.address])).to.equal(
        DEPOSIT_AMOUNT,
      );
      const [, , status] = await escrow.read.escrows([BOOKING_HASH_1]);
      expect(status).to.equal(STATUS_RELEASED);
    });

    it("rejects a non-operator caller", async function () {
      const { escrowAsAttacker } = await loadFixture(depositedFixture);
      await expect(escrowAsAttacker.write.release([BOOKING_HASH_1])).to.be
        .rejected;
    });

    it("rejects a hash with no deposit", async function () {
      const { escrowAsOperator } = await loadFixture(deployFixture);
      await expect(
        escrowAsOperator.write.release([BOOKING_HASH_2]),
      ).to.be.rejectedWith("FlightEscrow: not deposited");
    });

    it("rejects releasing the same booking twice", async function () {
      const { escrowAsOperator } = await loadFixture(depositedFixture);
      await escrowAsOperator.write.release([BOOKING_HASH_1]);
      await expect(
        escrowAsOperator.write.release([BOOKING_HASH_1]),
      ).to.be.rejectedWith("FlightEscrow: not deposited");
    });
  });

  describe("refund", function () {
    it("returns funds to the original payer and marks the escrow refunded", async function () {
      const { escrowAsOperator, token, payer, escrow } =
        await loadFixture(depositedFixture);
      const balanceBefore = await token.read.balanceOf([
        payer.account.address,
      ]);

      await escrowAsOperator.write.refund([BOOKING_HASH_1]);

      expect(
        await token.read.balanceOf([payer.account.address]),
      ).to.equal(balanceBefore + DEPOSIT_AMOUNT);
      const [, , status] = await escrow.read.escrows([BOOKING_HASH_1]);
      expect(status).to.equal(STATUS_REFUNDED);
    });

    it("rejects a non-operator caller", async function () {
      const { escrowAsAttacker } = await loadFixture(depositedFixture);
      await expect(escrowAsAttacker.write.refund([BOOKING_HASH_1])).to.be
        .rejected;
    });

    it("rejects a hash with no deposit", async function () {
      const { escrowAsOperator } = await loadFixture(deployFixture);
      await expect(
        escrowAsOperator.write.refund([BOOKING_HASH_2]),
      ).to.be.rejectedWith("FlightEscrow: not deposited");
    });

    it("rejects refunding an already-released booking", async function () {
      const { escrowAsOperator } = await loadFixture(depositedFixture);
      await escrowAsOperator.write.release([BOOKING_HASH_1]);
      await expect(
        escrowAsOperator.write.refund([BOOKING_HASH_1]),
      ).to.be.rejectedWith("FlightEscrow: not deposited");
    });
  });

  describe("setTreasury", function () {
    it("lets the admin update the treasury", async function () {
      const { escrowAsAdmin, escrow, attacker } =
        await loadFixture(deployFixture);
      await escrowAsAdmin.write.setTreasury([attacker.account.address]);
      expect(await escrow.read.treasury()).to.equal(
        getAddress(attacker.account.address),
      );
    });

    it("rejects a non-admin caller, including the operator", async function () {
      const { escrowAsOperator, attacker } = await loadFixture(deployFixture);
      await expect(
        escrowAsOperator.write.setTreasury([attacker.account.address]),
      ).to.be.rejected;
    });
  });
});
