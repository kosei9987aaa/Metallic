import { bareServerURL } from "../consts.js";
import { useLocalWindow } from "../settings.js";
import React, { useEffect } from "react";
import PublicIcon from "@mui/icons-material/Public";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import { getWindowLocation } from "../util.js";
import "../style/controls.css";
import BareClient from "@tomphttp/bare-client";
import { useSearchParams } from "react-router-dom";

/**
 * Return a blob URL to a working icon. Returns undefined if none work.
 * @param {BareClient} bare
 * @param {string[]} list List of absolute URLs to icons
 * @returns {string|undefined}
 */
async function workingIcon(bare, list) {
  for (var url of list)
    try {
      var res = await bare.fetch(url);
      if (!res.ok) continue;
      return URL.createObjectURL(await res.blob());
    } catch (err) {
      console.error(err);
    }
}

/**
 * Loads an image. If the image src is a blob, the blob will be revoked upon dismount.
 */
function BareIcon({ src, ...attributes }) {
  React.useEffect(() => {
    return () => {
      if (src.startsWith("blob:")) {
        URL.revokeObjectURL(src);
        console.log("revoked", src);
      }
    };
  }, [src]);

  // eslint-disable-next-line jsx-a11y/alt-text
  return <img src={src} {...attributes} />;
}

var Proxy = React.forwardRef(({ overrideWindow }, ref) => {
  var bare = React.useMemo(() => new BareClient(bareServerURL), []);
  var web = React.createRef();
  var [config, setConfig] = React.useState();
  var [localWindow] = useLocalWindow();
  var [searchParams, setSearchParams] = useSearchParams();

  React.useImperativeHandle(
    ref,
    () => ({
      open: (config) => {
        switch (overrideWindow || localWindow) {
          case "simple":
            window.location.href = config.url;
            break;
          case "ab":
            var page = window.open();
            page.document.body.innerHTML =
              `<iframe style="height:100%; width: 100%; border: none; position: fixed; top: 0; right: 0; left: 0; bottom: 0; border: none" sandbox="allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation allow-top-navigation-by-user-activation" src="` +
              new URL(config.url, window.location) +
              `"></iframe>`;
            break;
          default:
          case "default":
            document.body.style.overflow = "hidden";
            searchParams.set("fr", "");
            setSearchParams(searchParams);
            setConfig({
              url: config.url,
              title: null,
              icon: null,
            });
        }
        setConfig(config);
      },
    }),
    [localWindow, overrideWindow, searchParams, setSearchParams]
  );

  function close() {
    document.body.style.overflow = "";
    setConfig();
  }

  // close frame when ?frame removed (user went back in history)
  useEffect(() => {
    if (!searchParams.has("fr")) close();
  }, [searchParams]);

  if (!config) return;

  return (
    <>
      <div className="controls">
        <div className="controlsIcon">
          {config.icon ? (
            <BareIcon src={config.icon} alt="Website" />
          ) : (
            <PublicIcon fontSize="large" />
          )}
        </div>
        <div className="controlsTitle">{config.title || "Loading..."}</div>
        <div
          className="controlsButton"
          onClick={() => {
            web.current.requestFullscreen();
          }}
        >
          <FullscreenIcon />
        </div>
        <div
          className="controlsButton"
          onClick={() => {
            try {
              web.current.contentWindow.location.reload();
            } catch (err) {
              //
            }
          }}
        >
          <RefreshIcon />
        </div>
        <div className="controlsButton" onClick={close}>
          <CloseIcon />
        </div>
      </div>
      <iframe
        onLoad={async () => {
          var updatedConfig = {
            url: config.url,
          };

          updatedConfig.title =
            web.current.contentWindow.document.title ||
            getWindowLocation(web.current);

          var icon = web.current.contentWindow.document.querySelector(
            "link[rel*='icon'],link[rel='shortcut icon']"
          );

          updatedConfig.icon = await workingIcon(
            bare,
            [
              icon && icon.href,
              new URL(
                "/favicon.ico",
                web.current.contentWindow.document.baseURI
              ).toString(),
            ].filter(Boolean)
          );

          setConfig(updatedConfig);
        }}
        ref={web}
        className="web"
        src={config.url}
        title="Website"
      ></iframe>
    </>
  );
});

export { Proxy as default };
