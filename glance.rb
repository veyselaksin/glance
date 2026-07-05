class Glance < Formula
  desc "Glance - a Wails-based desktop app"
  homepage "https://github.com/veyselaksin/glance"
  url "https://github.com/veyselaksin/glance/releases/download/v1.0.1/Glance-macOS.zip"
  sha256 "REPLACE_WITH_ACTUAL_SHA256_HASH"

  def install
    prefix.install "Glance.app"

    bin.write_exec_script("#{prefix}/Glance.app/Contents/MacOS/Glance")
  end

  def caveats
    <<~EOS
      Glance is ad-hoc signed (no Apple Developer certificate), so macOS
      Gatekeeper may block it on first launch. If you see a verification
      error or a "cannot be opened" dialog, run:

          xattr -cr #{prefix}/Glance.app

      Then launch Glance again.
    EOS
  end
end
